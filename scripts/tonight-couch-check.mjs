// Run against a local static server and a disposable Chromium debugging instance.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { setTimeout as pause } from "node:timers/promises";

const [site = "http://127.0.0.1:8765", debuggerUrl = "http://127.0.0.1:9227", captures] = process.argv.slice(2);
const target = await fetch(debuggerUrl + "/json/new?about:blank", { method: "PUT" }).then(r => r.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
let messageId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
  if (!message.id) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
function send(method, params = {}) {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || expression);
  return result.result.value;
}
async function waitFor(expression) {
  for (let n = 0; n < 80; n++) {
    if (await evaluate(expression)) return;
    await pause(75);
  }
  throw new Error("Timed out: " + expression);
}
const element = id => 'document.getElementById(' + JSON.stringify(id) + ')';
const click = id => evaluate(element(id) + ".click()");
const visible = id => "!" + element(id) + ".hidden";
const title = name => element("tonightTitle") + ".textContent === " + JSON.stringify(name);
async function screenshot(name) {
  if (!captures) return;
  await evaluate("Promise.all([...document.images].filter(img => img.getClientRects().length).map(img => img.decode()))");
  const { data } = await send("Page.captureScreenshot", { format: "webp", quality: 73 });
  await writeFile(captures + "/" + name + ".webp", Buffer.from(data, "base64"));
}
async function reload() {
  await send("Page.reload");
  await pause(180);
}

const legacyKey = "tv-show-shelf-v1";
const profileKey = "tv-show-shelf-profiles-v1";
const getSaved = key => evaluate("JSON.parse(localStorage.getItem(" + JSON.stringify(key) + "))");
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.navigate", { url: site });
  await waitFor("document.readyState === 'complete'");
  await evaluate("localStorage.clear()");
  await reload();
  await waitFor(visible("onboarding") + " && !!document.querySelector('[data-familiar] img')");
  assert.equal(await evaluate("document.documentElement.scrollWidth"), 390);
  await screenshot("onboarding");
  await evaluate('document.querySelector("#watchServices input[value=YouTube]").click()');
  await waitFor("document.querySelectorAll('[data-familiar]').length === 1");
  await evaluate('document.querySelector("[data-familiar]").click()');
  await waitFor("!document.getElementById('startTonight').disabled");
  await evaluate("document.getElementById('familiarSearch').value = 'Bluey'; document.getElementById('familiarSearch').dispatchEvent(new Event('input'))");
  await waitFor("!!document.querySelector('[data-familiar=mock-1]')");
  await evaluate("document.querySelector('[data-familiar=mock-1]').click()");
  await waitFor("document.querySelector('[data-familiar=mock-1]').disabled");
  const added = (await getSaved(profileKey)).profiles.flatMap(p => p.shows);
  assert.deepEqual(added.map(s => [s.title, s.rating, s.watched]),
    [["SciShow Kids", 0, "Unwatched"], ["Bluey", 0, "Unwatched"]]);
  await click("startTonight");
  await waitFor(title("SciShow Kids"));
  assert.equal(await evaluate(element("artDots") + ".hidden"), true);
  await click("passTonight");
  await waitFor(title("Bluey"));
  assert.equal(await evaluate(element("artPosition") + ".textContent"), "Image 1 of 2");
  await screenshot("tonight-after-pass");
  const box = await evaluate("JSON.stringify(document.getElementById('pickArtwork').getBoundingClientRect())").then(JSON.parse);
  const touch = x => [{ x, y: box.y + box.height / 2 }];
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touch(box.right - 45) });
  await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: touch(box.left + 45) });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitFor(element("artPosition") + ".textContent === 'Image 2 of 2'");
  assert.equal(await evaluate(title("Bluey")), true);
  assert.equal(await evaluate("document.querySelector('[data-image=\"1\"]').getAttribute('aria-current')"), "true");
  await click("passTonight");
  await waitFor(visible("tonightEmpty"));
  await click("undoPass");
  await waitFor(title("Bluey"));
  await reload();
  await waitFor(title("Bluey"));
  await click("watchTonight");
  await waitFor(element("tonightActions") + ".hidden");
  await screenshot("confirmed");
  await reload();
  await waitFor(title("Bluey") + " && " + element("tonightActions") + ".hidden");
  assert.deepEqual((await getSaved(profileKey)).profiles.flatMap(p => p.shows), added);

  const show = (id, name, rating, watched) => ({ id, title: name, category: "Animation", rating, watched });
  const backup = {
    format: "tv-show-shelf-profiles", version: 1, activeId: "alex", profiles: [
      { id: "alex", name: "Alex", shows: [show(1, "Bluey", 5, "Unwatched"), show(2, "Puffin Rock", 4, "Watching")] },
      { id: "sam", name: "Sam", shows: [show(1, "Bluey", 1, "Unwatched"), show(2, "Puffin Rock", 4, "Watching")] },
      { id: "lee", name: "Lee", shows: [show(2, "Puffin Rock", 0, "Watching"), show(3, "Finished Show", 5, "Completed")] }
    ]
  };
  await evaluate("localStorage.clear(); localStorage.setItem(" + JSON.stringify(profileKey) + "," + JSON.stringify(JSON.stringify(backup)) + ")");
  await reload();
  await waitFor(visible("tonightView") + " && " + title("Puffin Rock") + " && !!document.querySelector('#pickArtwork img')");
  await screenshot("returning-household");
  await click("navShelf");
  await waitFor(visible("shelfView") + " && document.getElementById('cards').innerText.includes('Puffin Rock')");
  assert.deepEqual(await getSaved(profileKey), backup);
  const legacy = { kids: ["A", "B"], shows: [{
    id: 9, title: "Old favorite", category: "Nature", ratings: [5, 2], watched: "Watching"
  }] };
  await evaluate(`window.confirm = () => true;
    const input = document.getElementById("importFile");
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(JSON.stringify(legacy))}], "old.json"));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));`);
  await waitFor("document.getElementById('dataMessage').textContent.includes('successfully')");
  assert.deepEqual((await getSaved(profileKey)).profiles.map(p => p.shows[0]).map(s => [s.title, s.rating, s.watched]),
    [["Old favorite", 5, "Watching"], ["Old favorite", 2, "Watching"]]);
  assert.equal((await getSaved(legacyKey)).shows[0].title, "Old favorite");
  assert.deepEqual(errors, []);
  console.log("Passed at 390 × 844: empty shelf, providers, channel and title search, swipe, pass, undo, exhaustion, confirmation, reload, existing three-profile shelf, and legacy import.");
} finally {
  socket.close();
  await fetch(debuggerUrl + "/json/close/" + target.id);
}

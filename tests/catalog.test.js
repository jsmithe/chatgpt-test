const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const catalogScript = readFileSync(require.resolve("../catalog.js"), "utf8");
const html = readFileSync(require.resolve("../index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const bundled = JSON.parse(readFileSync(require.resolve("../catalog.json"), "utf8"));

function startCatalog(fetch) {
  const context = { window: {}, fetch };
  runInNewContext(catalogScript, context);
  return context.window.showCatalog;
}

const response = data => ({ ok: true, json: async () => data });

test("search keeps usable rows and optional metadata, and skips invalid IDs and titles", async () => {
  const catalog = startCatalog(async () => response([
    null, false, {}, { title: "Show without ID" },
    { id: [], title: "Show with array ID" },
    { id: false, title: "Show with boolean ID" },
    { id: null, title: "Show with null ID" },
    { id: " ", title: "Show with blank ID" },
    { id: "bad\u0000id", title: "Show with unusable ID" },
    { id: 2.5, title: "Show with fractional ID" },
    { id: Number.MAX_SAFE_INTEGER + 1, title: "Show with unsafe ID" },
    { id: "entry", title: " " },
    { id: "entry", title: " First Show ", overview: { bad: true }, genres: [false, " Nature ", null, ""] },
    { id: "other", title: "Second Show", genres: "Comedy" },
    { id: "complete", title: "Third Show", overview: "Underwater", genres: ["Adventure"], network: "PBS" }
  ]));
  const shows = await catalog.searchShows("show");
  assert.deepEqual(Array.from(shows, show => show.title), ["First Show", "Second Show", "Third Show"]);
  assert.equal(shows[0].overview, "");
  assert.deepEqual(Array.from(shows[0].genres), ["Nature"]);
  assert.equal(shows[1].overview, "");
  assert.equal(shows[1].genres.length, 0);
  assert.equal((await catalog.searchShows("nature"))[0].id, "entry");
  assert.equal((await catalog.searchShows("underwater"))[0].network, "PBS");
});

test("numeric and string IDs share a lookup key and the first usable duplicate wins", async () => {
  const catalog = startCatalog(async () => response([
    { id: 12, title: "First Show" },
    { id: " 12 ", title: "Duplicate Show" },
    { id: "012", title: "Leading Zero Show" },
    { id: 0, title: "Zero Show" }
  ]));
  const shows = await catalog.searchShows("show");
  assert.deepEqual(Array.from(shows, show => show.id), ["12", "012", "0"]);
  assert.equal(await catalog.getShowDetails(12), shows[0]);
  assert.equal(await catalog.getShowDetails("12"), shows[0]);
  assert.equal(await catalog.getShowDetails("012"), shows[1]);
  assert.equal(await catalog.getShowDetails("0"), shows[2]);
  assert.equal(await catalog.getShowDetails(true), null);
  assert.equal(await catalog.getShowDetails("missing"), null);
});

test("invalid catalog responses can be retried and successful results are cached", async () => {
  let requests = 0;
  const responses = [
    { ok: false },
    { ok: true, json: async () => { throw new SyntaxError("Invalid JSON"); } },
    response({ shows: [] }),
    response([{ id: "one", title: "Recovered Show" }])
  ];
  const catalog = startCatalog(async () => responses[requests++]);
  await assert.rejects(catalog.searchShows("show"), /could not be loaded/);
  await assert.rejects(catalog.searchShows("show"), /Invalid JSON/);
  await assert.rejects(catalog.searchShows("show"), /invalid format/);
  const [show] = await catalog.searchShows("show");
  assert.equal(show.title, "Recovered Show");
  assert.equal(await catalog.getShowDetails("one"), show);
  assert.equal(requests, 4);
});

test("all bundled entries retain their details and remain searchable", async () => {
  let requests = 0;
  const catalog = startCatalog(async () => {
    requests++;
    return response(bundled);
  });
  for (const entry of bundled) {
    assert.deepEqual(JSON.parse(JSON.stringify(await catalog.getShowDetails(entry.id))), entry);
    assert.ok((await catalog.searchShows(entry.title)).some(show => show.id === entry.id));
  }
  assert.equal(requests, 1);
});

test("catalog UI searches, expands and adds numeric-ID shows using browser string IDs", async () => {
  const elements = new Map();
  const messages = [];
  const storage = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const handlers = new Map();
      elements.set(id, {
        value: "",
        addEventListener(type, handler) { handlers.set(type, handler); },
        dispatch(type, event) { return handlers.get(type)(event); }
      });
    }
    return elements.get(id);
  }
  const details = { isConnected: true };
  const toggle = { dataset: { catalogToggle: "7" }, setAttribute() {} };
  const card = {
    querySelector(selector) {
      if (selector === "[data-catalog-details]") return details;
      if (selector === "[data-catalog-toggle]") return toggle;
      if (selector === ".catalog-add-message") return messages.at(-1);
    },
    append(message) { messages.push(message); }
  };
  const results = element("catalogResults");
  results.querySelector = selector => selector === '[data-catalog-result="7"]' ? card : null;
  results.querySelectorAll = selector => selector === "[data-catalog-details]" ? [details] : [toggle];
  const data = [
    { id: 7, title: "Sample Nature", genres: [null, "Nature"] },
    { id: "8", title: "Sample Unknown" }
  ];
  const context = {
    fetch: async url => url === "./catalog.json" ? response(data) : { ok: false },
    CSS: { escape: id => id },
    setTimeout: callback => callback(),
    localStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value)
    },
    document: {
      getElementById: element,
      querySelectorAll: () => [],
      createElement: () => ({})
    }
  };
  context.window = context;
  for (const script of [scripts[0], scripts[1], catalogScript, scripts[2]]) {
    runInNewContext(script, context);
  }
  await context.appReady;

  const search = element("catalogSearch");
  search.value = "sample";
  await search.dispatch("input");
  assert.match(results.innerHTML, /data-catalog-toggle="7"/);
  assert.match(results.innerHTML, /data-catalog-add="8"/);
  await results.dispatch("click", {
    target: { closest: selector => selector === "button[data-catalog-toggle]" ? toggle : null }
  });
  assert.match(details.innerHTML, /No overview available/);
  assert.match(details.innerHTML, /Nature/);

  for (const [id, expectedMessage] of [
    ["7", "Added to your collection."],
    ["8", "Added to your collection."],
    ["7", "That show is already in your collection."]
  ]) {
    const button = { dataset: { catalogAdd: id }, closest: () => card };
    await results.dispatch("click", {
      target: { closest: selector => selector === "button[data-catalog-add]" ? button : null }
    });
    assert.equal(messages[0].textContent, expectedMessage);
  }
  const saved = JSON.parse(storage.get("tv-show-shelf-v1"));
  assert.deepEqual(saved.shows.map(show => [show.title, show.category]),
    [["Sample Nature", "Nature"], ["Sample Unknown", "Other"]]);
});

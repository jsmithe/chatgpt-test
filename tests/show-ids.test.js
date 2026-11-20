const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const html = readFileSync(require.resolve("../index.html"), "utf8");
const shelfScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .slice(0, 2).map(match => match[1]).join("\n");
const profileScript = readFileSync(require.resolve("../profiles.js"), "utf8");
const legacyKey = "tv-show-shelf-v1";
const profileKey = "tv-show-shelf-profiles-v1";

async function startShelf(saved = {}, seed = null, confirm = () => true) {
  const storage = new Map(Object.entries(saved));
  const elements = new Map();
  const alerts = [];
  let cards = [];
  let exported;
  function makeElement() {
    return {
      value: "",
      dataset: {},
      children: [],
      listeners: new Map(),
      focus() { this.focused = true; },
      click() {},
      append(child) { this.children.push(child); },
      querySelector() { return null; },
      addEventListener(type, handler, capture) {
        const listeners = this.listeners.get(type) || [];
        if (capture) listeners.unshift(handler);
        else listeners.push(handler);
        this.listeners.set(type, listeners);
      },
      async dispatch(type, properties = {}) {
        let stopped = false;
        const event = {
          target: this,
          preventDefault() {},
          stopImmediatePropagation() { stopped = true; },
          ...properties
        };
        for (const listener of this.listeners.get(type) || []) {
          await listener(event);
          if (stopped) break;
        }
      }
    };
  }
  function element(id) {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  }
  class FixedDate extends Date {
    static now() { return 1700000000000; }
  }
  const context = {
    Date: FixedDate, console,
    alert: message => alerts.push(message),
    confirm, Blob,
    URL: { createObjectURL(blob) { exported = blob; return "blob:backup"; }, revokeObjectURL() {} },
    setTimeout() {},
    fetch: async () => ({ ok: seed !== null, json: async () => seed }),
    document: {
      getElementById: element,
      querySelector: element,
      querySelectorAll: selector => selector === "#cards .card" ? cards : [],
      createElement: makeElement
    },
    localStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value)
    }
  };
  context.window = context;
  runInNewContext(shelfScripts, context);
  await runInNewContext(profileScript, context);
  return {
    element, storage, alerts,
    backup: () => JSON.parse(storage.get(profileKey)),
    async exportBackup() {
      await element("exportButton").dispatch("click");
      return JSON.parse(await exported.text());
    },
    addFromCatalog: title => context.showShelf.addShow({ title }),
    async importBackup(data) {
      element("importFile").files = [{ name: "backup.json", text: async () => JSON.stringify(data) }];
      await element("importFile").dispatch("change");
      assert.deepEqual(alerts, []);
    },
    renderCards(ids) {
      cards = ids.map(id => Object.assign(makeElement(), { dataset: { showId: String(id) } }));
      context.render();
      return cards;
    }
  };
}

function profileBackup(...shows) {
  return {
    format: "tv-show-shelf-profiles",
    version: 1,
    activeId: "kid-a",
    profiles: [{ id: "kid-a", name: "A", shows }]
  };
}

test("confirmed removal updates the active profile, filters, suggestions, and exported data", async () => {
  let acceptRemoval = false;
  const prompts = [];
  const data = profileBackup(
    { id: 1, title: "Bluey", category: "Animation", rating: 5, watched: "Watching" },
    { id: 2, title: "Bluey", category: "Other", rating: 2, watched: "Completed" }
  );
  data.profiles.push({ id: "kid-b", name: "B", shows: [data.profiles[0].shows[0]] });
  const shelf = await startShelf({ [profileKey]: JSON.stringify(data) }, null, message => {
    prompts.push(message);
    return acceptRemoval;
  });
  const cards = shelf.element("cards");
  const mode = shelf.element("suggestMode");
  mode.value = "favorites";
  await mode.dispatch("change");
  assert.match(shelf.element("suggestions").innerHTML, /Bluey/);
  assert.match(cards.innerHTML, /data-remove-show="1" aria-label="Remove Bluey"/);
  const filter = shelf.element("filter");
  filter.value = "Animation";
  await filter.dispatch("change");
  const remove = () => cards.dispatch("click", {
    target: {
      closest: selector => selector === "button[data-remove-show]" ? { dataset: { removeShow: "1" } } : null
    }
  });
  await remove();
  assert.equal(shelf.backup().profiles[0].shows.length, 2);
  assert.match(cards.innerHTML, /data-remove-show="1"/);
  assert.match(prompts[0], /Bluey.*A's collection/);

  acceptRemoval = true;
  const picker = shelf.element("pickResult");
  picker.textContent = "Bluey";
  await remove();
  assert.doesNotMatch(cards.innerHTML, /data-remove-show="1"/);
  assert.match(cards.innerHTML, /data-remove-show="2"/);
  assert.equal(filter.value, "");
  assert.doesNotMatch(filter.innerHTML, /Animation/);
  assert.doesNotMatch(shelf.element("suggestions").innerHTML, /Bluey/);
  assert.equal(picker.textContent, "");
  assert.equal(shelf.element("search").focused, true);
  const saved = shelf.backup();
  assert.deepEqual(saved.profiles[0].shows, [data.profiles[0].shows[1]]);
  assert.deepEqual(saved.profiles[1].shows, data.profiles[1].shows);
  const reloaded = await startShelf(Object.fromEntries(shelf.storage));
  assert.deepEqual(reloaded.backup(), saved);

  const exported = await shelf.exportBackup();
  const imported = await startShelf();
  await imported.importBackup(exported);
  assert.deepEqual(imported.backup(), saved);
});

test("rapid manual and catalog additions get distinct IDs and rate independently", async () => {
  const shelf = await startShelf();
  const title = shelf.element("title");
  for (const name of ["Manual A", "Manual B"]) {
    title.value = name;
    await shelf.element("addForm").dispatch("submit");
  }
  shelf.addFromCatalog("Catalog A");
  shelf.addFromCatalog("Catalog B");
  const shows = shelf.backup().profiles[0].shows;
  const ids = shows.map(show => show.id);
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  await shelf.element("cards").dispatch("click", {
    target: { closest: () => ({ dataset: { id: String(ids[2]), kid: "0", value: "5" } }) }
  });
  assert.deepEqual(shelf.backup().profiles[0].shows.map(show => show.rating), [0, 0, 5, 0]);
});

test("profile import repairs duplicate and missing IDs while preserving shows and profile boundaries", async () => {
  const shelf = await startShelf();
  const data = profileBackup(
    { id: 42, title: "Same title", rating: 3, watched: "Watching" },
    { id: "42", title: "Same title", rating: 5, watched: "Completed" },
    { title: "Missing ID" },
    { id: 1, title: "Reserved ID" }
  );
  data.profiles.push({ id: "kid-b", name: "B", shows: [{ id: 42, title: "Other profile" }] });
  await shelf.importBackup(data);
  const [first, second] = shelf.backup().profiles;
  const ids = first.shows.map(show => show.id);
  assert.equal(new Set(ids).size, 4);
  assert.equal(ids[0], 42);
  assert.equal(ids[3], 1);
  assert.equal(second.shows[0].id, 42);
  assert.deepEqual(first.shows.slice(0, 2).map(({ rating, watched }) => [rating, watched]),
    [[3, "Watching"], [5, "Completed"]]);
  assert.match(shelf.element("cards").innerHTML, new RegExp('data-show-id="' + ids[1] + '"'));
  const [, duplicateTitleCard] = shelf.renderCards(ids);
  const select = duplicateTitleCard.children[0].children[0];
  select.value = "Unwatched";
  await select.dispatch("change");
  assert.deepEqual(shelf.backup().profiles[0].shows.slice(0, 2).map(show => show.watched),
    ["Watching", "Unwatched"]);
  const reloaded = await startShelf(Object.fromEntries(shelf.storage));
  assert.deepEqual(reloaded.backup(), shelf.backup());
});

const legacyData = {
  kids: ["A", "B"],
  shows: [
    { id: 1700000000000, title: "First", category: "Comedy", ratings: [4, 2], watched: "Watching" },
    { id: "1700000000000", title: "Second", category: "Nature", ratings: [1, 5], watched: "Completed" },
    { id: 1700000000001, title: "Third", category: "Other", ratings: [0, 0] }
  ]
};

function assertLegacyMigration(backup) {
  const [first, second] = backup.profiles;
  for (const profile of [first, second]) {
    const ids = profile.shows.map(show => show.id);
    assert.equal(new Set(ids).size, 3);
    assert.equal(ids[0], 1700000000000);
    assert.equal(ids[2], 1700000000001);
    assert.deepEqual(profile.shows.map(show => show.watched), ["Watching", "Completed", "Unwatched"]);
  }
  assert.deepEqual(first.shows.map(show => show.rating), [4, 1, 0]);
  assert.deepEqual(second.shows.map(show => show.rating), [2, 5, 0]);
}

test("legacy backup import preserves both kids' ratings and repairs IDs", async () => {
  const shelf = await startShelf();
  await shelf.importBackup(legacyData);
  assertLegacyMigration(shelf.backup());
});

test("legacy local storage and seed files still migrate", async () => {
  assertLegacyMigration((await startShelf({ [legacyKey]: JSON.stringify(legacyData) })).backup());
  assertLegacyMigration((await startShelf({}, legacyData)).backup());
});

test("saved versioned profiles keep valid numeric IDs and repair old duplicates", async () => {
  const data = profileBackup(
    { id: 1700000000000, title: "First", category: "Nature", rating: 4, watched: "Watching" },
    { id: 1700000000000, title: "Second", category: "Comedy", rating: 2, watched: "Completed" },
    { id: 1700000000001, title: "Third", category: "Other", rating: 0, watched: "Unwatched" }
  );
  const shelf = await startShelf({ [profileKey]: JSON.stringify(data) });
  const repaired = shelf.backup();
  assert.equal(repaired.activeId, data.activeId);
  assert.deepEqual(repaired.profiles[0].shows[0], data.profiles[0].shows[0]);
  assert.deepEqual(repaired.profiles[0].shows[2], data.profiles[0].shows[2]);
  const second = repaired.profiles[0].shows[1];
  assert.deepEqual(second, { ...data.profiles[0].shows[1], id: second.id });
  assert.equal(new Set(repaired.profiles[0].shows.map(show => show.id)).size, 3);
});

test("import replaces out-of-range and non-integer IDs without changing valid IDs or show data", async () => {
  const shelf = await startShelf();
  const invalidIds = [-1, 0, 1.5, "2.5", Number.MAX_SAFE_INTEGER + 1, "9007199254740993"];
  const invalidShows = invalidIds.map((id, index) => ({
    id, title: "Show " + index, category: "Nature", rating: 4, watched: "Watching"
  }));
  const data = profileBackup(
    ...invalidShows,
    { id: 1, title: "Reserved ID" },
    { id: String(Number.MAX_SAFE_INTEGER), title: "Largest safe ID" }
  );
  await shelf.importBackup(data);
  const shows = shelf.backup().profiles[0].shows;
  const ids = shows.map(show => show.id);
  assert.equal(ids.length, invalidIds.length + 2);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => Number.isSafeInteger(id) && id > 0));
  assert.deepEqual(ids.slice(-2), [1, Number.MAX_SAFE_INTEGER]);
  assert.deepEqual(shows.slice(0, invalidShows.length).map(({ id, ...show }) => show),
    invalidShows.map(({ id, ...show }) => show));
});

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const html = readFileSync(require.resolve("../index.html"), "utf8");
const shelfScript = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test("clear search is named, restores focus and preserves the selected category", async () => {
  assert.match(html, /<button id="clearSearch" type="button"[^>]+aria-label="Clear show search" hidden>/);
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const listeners = new Map();
      elements.set(id, {
        value: "",
        focus() { this.focused = true; },
        addEventListener(type, listener) { listeners.set(type, listener); },
        dispatch(type) { listeners.get(type)(); }
      });
    }
    return elements.get(id);
  }
  const seed = JSON.parse(readFileSync(require.resolve("../shows.json"), "utf8"));
  const context = {
    document: { getElementById: element },
    localStorage: { getItem: () => JSON.stringify(seed) }
  };
  context.window = context;
  runInNewContext(shelfScript, context);
  await context.appReady;

  const search = element("search");
  const clear = element("clearSearch");
  const filter = element("filter");
  const cards = element("cards");
  assert.equal(clear.hidden, true);
  filter.value = "Adventure";
  filter.dispatch("change");
  search.value = "Pokémon";
  search.dispatch("input");
  assert.equal(clear.hidden, false);
  assert.match(cards.innerHTML, /Pokémon/);
  assert.doesNotMatch(cards.innerHTML, /Avatar/);

  clear.dispatch("click");
  assert.equal(clear.hidden, true);
  assert.equal(search.value, "");
  assert.equal(search.focused, true);
  assert.equal(filter.value, "Adventure");
  assert.match(cards.innerHTML, /Pokémon/);
  assert.match(cards.innerHTML, /Avatar/);
  assert.doesNotMatch(cards.innerHTML, /Bluey/);
});

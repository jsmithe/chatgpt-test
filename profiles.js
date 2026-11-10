/* Flexible, family-managed kid profiles. Each profile owns an independent collection. */
(async function () {
  const PROFILE_KEY = "tv-show-shelf-profiles-v1";
  const legacySave = save;
  const legacyRender = render;
  let profiles = [];
  let activeId = "";
  let nextId = 1;

  const makeId = () => "kid-" + Date.now().toString(36) + "-" + (nextId++).toString(36);
  const normalizeShow = (show, rating) => ({
    id: show.id, title: show.title, category: show.category,
    ratings: [Number(rating) || 0, 0],
    watched: ["Unwatched", "Watching", "Completed"].includes(show.watched) ? show.watched : "Unwatched"
  });

  function currentProfile() { return profiles.find(p => p.id === activeId) || profiles[0]; }
  function loadIntoState() {
    const p = currentProfile();
    if (!p) return;
    activeId = p.id;
    state.kids = [p.name, ""];
    state.shows = p.shows.map(s => normalizeShow(s, s.rating));
  }
  function persist() {
    const p = currentProfile();
    if (p) {
      p.shows = state.shows.map(s => ({
        id: s.id, title: s.title, category: s.category,
        rating: Number(s.ratings[0]) || 0, watched: s.watched || "Unwatched"
      }));
    }
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, activeId, profiles }));
    // Keep the legacy key populated with the active collection for older app versions.
    legacySave();
  }
  function message(value) {
    const el = document.getElementById("profileMessage");
    if (el) el.textContent = value;
  }
  function refreshSelector() {
    const select = document.getElementById("activeProfile");
    if (!select) return;
    select.innerHTML = profiles.map(p => '<option value="' + escapeHTML(p.id) + '">' + escapeHTML(p.name) + '</option>').join("");
    select.value = activeId;
  }
  function refreshProfileUI() {
    refreshSelector();
    legacyRender();
    if (window.renderSuggestions) window.renderSuggestions();
  }

  // Migrate the old shared list into one independent list per existing kid.
  function migrateLegacyState() {
    profiles = state.kids.map((name, index) => ({
      id: makeId(),
      name: String(name || "Kid " + (index + 1)).trim().slice(0, 24) || "Kid " + (index + 1),
      shows: state.shows.map(show => ({
        id: show.id, title: show.title, category: show.category,
        rating: Number(show.ratings[index]) || 0,
        watched: show.watched || "Unwatched"
      }))
    }));
    activeId = profiles[0].id;
  }

  await initialize();
  let savedProfiles = null;
  try { savedProfiles = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch (_) {}
  if (savedProfiles && savedProfiles.version === 1 && Array.isArray(savedProfiles.profiles) && savedProfiles.profiles.length) {
    profiles = savedProfiles.profiles
      .filter(p => p && typeof p.id === "string" && typeof p.name === "string" && Array.isArray(p.shows))
      .map(p => ({
        id: p.id, name: p.name.slice(0, 24),
        shows: p.shows.filter(s => s && typeof s.title === "string" && Array.isArray(s.ratings) || s && typeof s.title === "string" && Number.isInteger(s.rating))
          .map(s => ({ id: s.id, title: s.title, category: s.category || "Other", rating: Number(s.rating ?? s.ratings?.[0]) || 0, watched: s.watched || "Unwatched" }))
      }));
    if (!profiles.length) migrateLegacyState();
    activeId = profiles.some(p => p.id === savedProfiles.activeId) ? savedProfiles.activeId : profiles[0].id;
  } else {
    migrateLegacyState();
  }

  // Replace the fixed two-name panel with profile management controls.
  const profilePanel = document.querySelector("main > .panel");
  profilePanel.innerHTML = '<h2>Kid profiles</h2><div class="profile-controls">' +
    '<div class="field"><label for="activeProfile">Current collection</label><select id="activeProfile"></select></div>' +
    '<div class="field"><label for="newProfileName">Add a kid</label><input id="newProfileName" maxlength="24" placeholder="Profile name"></div>' +
    '<div class="profile-buttons"><button type="button" id="addProfile">＋ Add profile</button><button type="button" class="secondary" id="renameProfile">Rename</button><button type="button" class="secondary" id="removeProfile">Remove</button></div></div>' +
    '<p class="foot" id="profileMessage" aria-live="polite">Each kid has a separate show collection, ratings, and watch status.</p>';
  refreshSelector();

  document.getElementById("activeProfile").addEventListener("change", e => {
    persist();
    activeId = e.target.value;
    loadIntoState();
    legacySave();
    refreshProfileUI();
  });
  document.getElementById("addProfile").addEventListener("click", () => {
    const input = document.getElementById("newProfileName");
    const name = input.value.trim();
    if (!name) return message("Enter a name for the new profile.");
    if (profiles.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return message("A profile with that name already exists.");
    const p = { id: makeId(), name: name.slice(0, 24), shows: [] };
    profiles.push(p); activeId = p.id; input.value = "";
    loadIntoState(); persist(); refreshProfileUI(); message(p.name + "'s collection is ready.");
  });
  document.getElementById("renameProfile").addEventListener("click", () => {
    const p = currentProfile();
    const name = window.prompt("Rename this profile:", p.name);
    if (name === null) return;
    const clean = name.trim().slice(0, 24);
    if (!clean) return message("Profile names cannot be blank.");
    if (profiles.some(other => other.id !== p.id && other.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) return message("A profile with that name already exists.");
    p.name = clean; state.kids[0] = clean; persist(); refreshSelector(); legacyRender(); message("Profile renamed.");
  });
  document.getElementById("removeProfile").addEventListener("click", () => {
    const p = currentProfile();
    if (profiles.length === 1) return message("At least one profile is required. Add another before removing this one.");
    if (!window.confirm("Remove " + p.name + " and its " + p.shows.length + " shows and ratings? This cannot be undone.")) return;
    profiles = profiles.filter(other => other.id !== p.id);
    activeId = profiles[0].id; loadIntoState(); persist(); refreshProfileUI(); message("Profile removed.");
  });

  // All existing app mutations now persist only to the active profile.
  save = persist;
  render = function () {
    legacyRender();
    document.querySelectorAll("#cards .card .rating:nth-of-type(3)").forEach(el => el.remove());
    document.querySelectorAll("#cards .card .rating").forEach(el => {
      const label = el.querySelector("span:first-child");
      if (label) label.textContent = currentProfile().name;
    });
  };

  // Keep the existing suggestions useful for the selected kid.
  const modeSelect = document.getElementById("suggestMode");
  modeSelect.innerHTML = '<option value="favorites">This kid’s highest-rated shows</option><option value="unrated">Not rated by this kid</option><option value="category">Favorite categories</option>';
  window.renderSuggestions = function () {
    const mode = modeSelect.value;
    const count = Number(document.getElementById("suggestCount").value);
    const rows = state.shows.map(show => {
      const rating = Number(show.ratings[0]) || 0;
      const categoryRatings = state.shows.filter(s => s.category === show.category).map(s => Number(s.ratings[0]) || 0).filter(Boolean);
      let score = -1, reason = "";
      if (mode === "favorites" && rating > 0) { score = rating; reason = rating + " out of 5 stars"; }
      if (mode === "unrated" && rating === 0) { score = 1; reason = "Not rated by " + currentProfile().name; }
      if (mode === "category" && categoryRatings.length) { score = categoryRatings.reduce((a,b) => a+b, 0) / categoryRatings.length; reason = "Category average " + score.toFixed(1); }
      return { show, score, reason };
    }).filter(x => x.score >= 0 && x.show.watched !== "Completed");
    rows.sort((a,b) => b.score - a.score || a.show.title.localeCompare(b.show.title));
    document.getElementById("suggestions").innerHTML = rows.length
      ? rows.slice(0, count).map(x => '<article class="card"><h3>' + escapeHTML(x.show.title) + '</h3><span class="tag">' + escapeHTML(x.show.category) + '</span><p class="suggestion-note">' + escapeHTML(x.reason) + ' · ' + escapeHTML(x.show.watched || "Unwatched") + '</p></article>').join("")
      : '<p class="empty">No suggestions yet. Add shows or ratings to get started.</p>';
  };
  modeSelect.addEventListener("change", window.renderSuggestions);
  document.getElementById("suggestCount").addEventListener("change", window.renderSuggestions);

  // Persist profile-specific changes from all existing controls and integrations.
  const cards = document.getElementById("cards");
  cards.addEventListener("click", () => setTimeout(() => { persist(); window.renderSuggestions(); }, 0));
  const addForm = document.getElementById("addForm");
  addForm.addEventListener("submit", () => setTimeout(() => { persist(); window.renderSuggestions(); }, 0));
  const importInput = document.getElementById("importFile");
  importInput.addEventListener("change", () => setTimeout(() => { persist(); window.renderSuggestions(); }, 0));
  if (window.showShelf) {
    const oldAdd = window.showShelf.addShow;
    window.showShelf.addShow = function (show) {
      const result = oldAdd(show); persist(); window.renderSuggestions(); return result;
    };
  }

  loadIntoState();
  persist();
  refreshProfileUI();
})();
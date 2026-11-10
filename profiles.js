/* Flexible kid profiles with independent collections and profile-aware backups. */
(async function () {
  const PROFILE_KEY = "tv-show-shelf-profiles-v1";
  await window.appReady;

  let profiles = [];
  let activeId = "";
  let nextId = 1;

  const makeId = () => "kid-" + Date.now().toString(36) + "-" + (nextId++).toString(36);
  const currentProfile = () => profiles.find(profile => profile.id === activeId) || profiles[0];

  function normalizeShow(show, rating) {
    return {
      id: Number.isFinite(Number(show.id)) ? Number(show.id) : Date.now() + Math.floor(Math.random() * 1000),
      title: String(show.title || "").trim(),
      category: String(show.category || "Other"),
      ratings: [Number.isInteger(Number(rating)) && Number(rating) >= 0 && Number(rating) <= 5 ? Number(rating) : 0, 0],
      watched: ["Unwatched", "Watching", "Completed"].includes(show.watched) ? show.watched : "Unwatched"
    };
  }

  function snapshotProfile(profile) {
    return {
      id: profile.id,
      name: profile.name,
      shows: profile.shows.map(show => ({
        id: show.id, title: show.title, category: show.category,
        rating: show.rating, watched: show.watched
      }))
    };
  }

  function loadIntoState() {
    const profile = currentProfile();
    if (!profile) return;
    activeId = profile.id;
    state.kids = [profile.name, ""];
    state.shows = profile.shows.map(show => normalizeShow(show, show.rating));
  }

  function persist() {
    const profile = currentProfile();
    if (profile) {
      profile.shows = state.shows.map(show => ({
        id: show.id, title: show.title, category: show.category,
        rating: Number(show.ratings[0]) || 0,
        watched: show.watched || "Unwatched"
      }));
    }
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      format: "tv-show-shelf-profiles", version: 1, activeId,
      profiles: profiles.map(snapshotProfile)
    }));
    // Maintain the previous storage key as an active-profile compatibility snapshot.
    oldSave();
  }

  const oldSave = save;
  const oldRender = render;

  function renderProfile() {
    oldRender();
    document.querySelectorAll("#cards .card .rating:nth-of-type(3)").forEach(row => row.remove());
    document.querySelectorAll("#cards .card .rating").forEach(row => {
      const label = row.querySelector("span:first-child");
      if (label) label.textContent = currentProfile().name;
    });
    renderSuggestions();
  }

  function refreshSelector() {
    const select = document.getElementById("activeProfile");
    select.innerHTML = profiles.map(profile =>
      '<option value="' + escapeHTML(profile.id) + '">' + escapeHTML(profile.name) + '</option>'
    ).join("");
    select.value = activeId;
  }

  function showMessage(value) {
    document.getElementById("profileMessage").textContent = value;
  }

  function createProfilesFromLegacy(data) {
    const legacy = validState(data);
    return legacy.kids.map((name, index) => ({
      id: makeId(),
      name: name || "Kid " + (index + 1),
      shows: legacy.shows.map(show => ({
        id: show.id, title: show.title, category: show.category,
        rating: Number(show.ratings[index]) || 0,
        watched: show.watched || "Unwatched"
      }))
    }));
  }

  function parseProfileBackup(data) {
    if (!data || (data.format !== "tv-show-shelf-profiles" && data.format !== undefined) || data.version !== 1 ||
        !Array.isArray(data.profiles) || data.profiles.length === 0) {
      throw new Error("This is not a supported profile backup.");
    }
    const parsed = data.profiles.map((profile, index) => {
      if (!profile || typeof profile.name !== "string" || !Array.isArray(profile.shows)) {
        throw new Error("Profile " + (index + 1) + " has invalid data.");
      }
      const name = profile.name.trim().slice(0, 24);
      if (!name) throw new Error("Profile names cannot be blank.");
      const shows = profile.shows.map((show, showIndex) => {
        if (!show || typeof show.title !== "string" || !show.title.trim()) {
          throw new Error("A show in profile " + name + " has an invalid title (item " + (showIndex + 1) + ").");
        }
        const rating = show.rating === undefined && Array.isArray(show.ratings) ? Number(show.ratings[0]) || 0 : Number(show.rating ?? 0);
        if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
          throw new Error("A rating in profile " + name + " must be a whole number from 0 to 5.");
        }
        return {
          id: Number.isFinite(Number(show.id)) ? Number(show.id) : Date.now() + showIndex,
          title: show.title.trim(), category: String(show.category || "Other"),
          rating, watched: ["Unwatched", "Watching", "Completed"].includes(show.watched) ? show.watched : "Unwatched"
        };
      });
      return { id: typeof profile.id === "string" && profile.id ? profile.id : makeId(), name, shows };
    });
    const names = parsed.map(profile => profile.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) throw new Error("Profile names must be unique.");
    return parsed;
  }

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch (_) {}
  if (saved && saved.version === 1 && (saved.format === "tv-show-shelf-profiles" || saved.format === undefined)) {
    try {
      profiles = parseProfileBackup(saved);
      activeId = profiles.some(profile => profile.id === saved.activeId) ? saved.activeId : profiles[0].id;
    } catch (error) {
      console.warn("Saved profiles could not be loaded; migrating the existing collection.", error);
      profiles = createProfilesFromLegacy(state);
      activeId = profiles[0].id;
    }
  } else {
    // First launch: split the old shared list into one collection per existing kid.
    profiles = createProfilesFromLegacy(state);
    activeId = profiles[0].id;
  }

  const profilePanel = document.querySelector("main > .panel");
  profilePanel.innerHTML =
    '<h2>Kid profiles</h2><div class="profile-controls">' +
    '<div class="field"><label for="activeProfile">Current collection</label><select id="activeProfile"></select></div>' +
    '<div class="field"><label for="newProfileName">Add a kid</label><input id="newProfileName" maxlength="24" placeholder="Profile name"></div>' +
    '<div class="profile-buttons"><button type="button" id="addProfile">＋ Add profile</button>' +
    '<button type="button" class="secondary" id="renameProfile">Rename</button>' +
    '<button type="button" class="secondary" id="removeProfile">Remove</button></div></div>' +
    '<div hidden><input id="kid1"><input id="kid2"></div>' +
    '<p class="foot" id="profileMessage" aria-live="polite">Each kid has a separate show collection, rating, and watch status.</p>';

  // The old renderer expects these compatibility inputs to exist; they stay hidden.
  loadIntoState();
  save = persist;
  render = renderProfile;

  const modeSelect = document.getElementById("suggestMode");
  modeSelect.innerHTML =
    '<option value="favorites">This kid’s highest-rated shows</option>' +
    '<option value="unrated">Not rated by this kid</option>' +
    '<option value="category">Favorite categories</option>';

  function renderSuggestions() {
    const mode = modeSelect.value;
    const count = Number(document.getElementById("suggestCount").value) || 5;
    const shows = state.shows.map(show => {
      const rating = Number(show.ratings[0]) || 0;
      const categoryRatings = state.shows
        .filter(item => item.category === show.category)
        .map(item => Number(item.ratings[0]) || 0).filter(Boolean);
      let score = -1;
      let reason = "";
      if (mode === "favorites" && rating > 0) {
        score = rating; reason = rating + " out of 5 stars";
      } else if (mode === "unrated" && rating === 0) {
        score = 1; reason = "Not rated by " + currentProfile().name;
      } else if (mode === "category" && categoryRatings.length) {
        score = categoryRatings.reduce((sum, value) => sum + value, 0) / categoryRatings.length;
        reason = "Category average " + score.toFixed(1);
      }
      return { show, score, reason };
    }).filter(item => item.score >= 0 && item.show.watched !== "Completed");
    shows.sort((a, b) => b.score - a.score || a.show.title.localeCompare(b.show.title));
    document.getElementById("suggestions").innerHTML = shows.length
      ? shows.slice(0, count).map(item =>
        '<article class="card"><h3>' + escapeHTML(item.show.title) + '</h3><span class="tag">' +
        escapeHTML(item.show.category) + '</span><p class="suggestion-note">' +
        escapeHTML(item.reason) + ' · ' + escapeHTML(item.show.watched || "Unwatched") +
        '</p></article>').join("")
      : '<p class="empty">No suggestions yet. Add shows or ratings to get started.</p>';
  }
  window.renderSuggestions = renderSuggestions;
  modeSelect.addEventListener("change", renderSuggestions);
  document.getElementById("suggestCount").addEventListener("change", renderSuggestions);

  document.getElementById("activeProfile").addEventListener("change", event => {
    persist();
    activeId = event.target.value;
    loadIntoState();
    persist();
    refreshSelector();
    renderProfile();
  });

  document.getElementById("addProfile").addEventListener("click", () => {
    const input = document.getElementById("newProfileName");
    const name = input.value.trim().slice(0, 24);
    if (!name) return showMessage("Enter a name for the new profile.");
    if (profiles.some(profile => profile.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return showMessage("A profile with that name already exists.");
    }
    persist();
    const profile = { id: makeId(), name, shows: [] };
    profiles.push(profile);
    activeId = profile.id;
    input.value = "";
    loadIntoState();
    persist();
    refreshSelector();
    renderProfile();
    showMessage(name + "'s collection is ready.");
  });

  document.getElementById("renameProfile").addEventListener("click", () => {
    const profile = currentProfile();
    const proposed = window.prompt("Rename this profile:", profile.name);
    if (proposed === null) return;
    const name = proposed.trim().slice(0, 24);
    if (!name) return showMessage("Profile names cannot be blank.");
    if (profiles.some(other => other.id !== profile.id && other.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return showMessage("A profile with that name already exists.");
    }
    profile.name = name;
    state.kids[0] = name;
    persist();
    refreshSelector();
    renderProfile();
    showMessage("Profile renamed.");
  });

  document.getElementById("removeProfile").addEventListener("click", () => {
    const profile = currentProfile();
    if (profiles.length === 1) return showMessage("At least one profile is required. Add another before removing this one.");
    if (!window.confirm("Remove " + profile.name + " and its " + profile.shows.length + " shows and ratings? This cannot be undone.")) return;
    profiles = profiles.filter(other => other.id !== profile.id);
    activeId = profiles[0].id;
    loadIntoState();
    persist();
    refreshSelector();
    renderProfile();
    showMessage("Profile removed.");
  });

  // Profile-aware JSON export replaces the legacy two-kid export handler.
  document.getElementById("exportButton").addEventListener("click", event => {
    event.stopImmediatePropagation();
    persist();
    const backup = {
      format: "tv-show-shelf-profiles", version: 1, activeId,
      profiles: profiles.map(snapshotProfile)
    };
    const blob = new Blob([JSON.stringify(backup, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "shows-profiles.json"; link.click();
    URL.revokeObjectURL(url);
    document.getElementById("dataMessage").textContent = "Downloaded a backup containing every profile and collection.";
  }, true);

  // Import both the new profile format and the old two-kid format without dropping ratings.
  document.getElementById("importFile").addEventListener("change", async event => {
    event.stopImmediatePropagation();
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      let importedProfiles;
      let importedActive = "";
      if (data && data.format === "tv-show-shelf-profiles") {
        importedProfiles = parseProfileBackup(data);
        importedActive = data.activeId;
      } else {
        importedProfiles = createProfilesFromLegacy(data);
        importedActive = importedProfiles[0].id;
      }
      const totalShows = importedProfiles.reduce((sum, profile) => sum + profile.shows.length, 0);
      if (!window.confirm("Replace all profiles with " + importedProfiles.length + " profiles and " + totalShows + " show entries from " + file.name + "?")) return;
      profiles = importedProfiles;
      activeId = profiles.some(profile => profile.id === importedActive) ? importedActive : profiles[0].id;
      loadIntoState();
      persist();
      refreshSelector();
      renderProfile();
      document.getElementById("pickResult").textContent = "";
      document.getElementById("dataMessage").textContent = "Imported " + profiles.length + " profiles and " + totalShows + " show entries successfully.";
    } catch (error) {
      window.alert("Could not import JSON: " + error.message);
    } finally {
      event.target.value = "";
    }
  }, true);

  // Save changes from legacy controls and the catalog's add-to-collection integration.
  document.getElementById("cards").addEventListener("click", () => {
    window.setTimeout(() => { persist(); renderSuggestions(); }, 0);
  });
  document.getElementById("addForm").addEventListener("submit", () => {
    window.setTimeout(() => { persist(); renderSuggestions(); }, 0);
  });
  if (window.showShelf) {
    const addShow = window.showShelf.addShow;
    window.showShelf.addShow = function (show) {
      const result = addShow(show);
      persist();
      renderSuggestions();
      return result;
    };
  }

  persist();
  refreshSelector();
  renderProfile();
})();
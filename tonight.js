(async function () {
  await window.shelfReady;

  const get = id => document.getElementById(id);
  const views = { tonight: get("tonightView"), browse: get("onboarding"), shelf: get("shelfView") };
  const serviceKey = "our-show-services";
  const eveningKey = "our-show-evening";
  const titleKey = title => title.trim().toLocaleLowerCase();
  const identity = show => JSON.stringify([titleKey(show.title), titleKey(show.category)]);
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch (_) { return fallback; }
  };
  const serviceInputs = [...get("watchServices").querySelectorAll("input")];
  const storedServices = read(serviceKey, []);
  for (const input of serviceInputs) input.checked = Array.isArray(storedServices) && storedServices.includes(input.value);
  const services = () => serviceInputs.filter(input => input.checked).map(input => input.value);
  let view;
  let current;
  let imageIndex = 0;
  let dragStart;
  let browseVersion = 0;
  let catalog = [];
  let catalogPromise;

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = window.showCatalog.browseShows().then(shows => { catalog = shows; })
        .catch(error => { catalogPromise = null; throw error; });
    }
    return catalogPromise;
  }

  // The evening rolls over at 4 a.m. local time so midnight doesn't reset a pick.
  function eveningDate() {
    const day = new Date();
    if (day.getHours() < 4) day.setDate(day.getDate() - 1);
    return [day.getFullYear(), day.getMonth() + 1, day.getDate()].join("-");
  }
  function evening() {
    const date = eveningDate();
    const saved = read(eveningKey, null);
    return saved?.date === date && Array.isArray(saved.passes) ? saved : { date, passes: [], chosen: null };
  }
  function saveEvening(value) {
    localStorage.setItem(eveningKey, JSON.stringify(value));
  }

  function candidates() {
    const groups = new Map();
    for (const profile of window.showShelf.getProfiles()) {
      for (const show of profile.shows) {
        const key = identity(show);
        if (!groups.has(key)) groups.set(key, { ...show, key, viewers: new Map() });
        const viewers = groups.get(key).viewers;
        if (!viewers.has(profile.id)) viewers.set(profile.id, []);
        viewers.get(profile.id).push(show);
      }
    }
    const preferences = services();
    return [...groups.values()].flatMap(show => {
      const rows = [...show.viewers.values()].flat();
      if (rows.every(row => row.watched === "Completed")) return [];
      const known = [...show.viewers.values()].map(entries => {
        const ratings = entries.map(row => row.rating).filter(Boolean);
        return ratings.length ? Math.min(...ratings) : 0;
      });
      const watching = rows.some(row => row.watched === "Watching");
      const disliked = known.filter(rating => rating > 0 && rating <= 2).length;
      const liked = known.filter(rating => rating >= 4).length;
      const details = catalog.find(item => titleKey(item.title) === titleKey(show.title));
      const matchesService = preferences.includes(details?.service);
      return [{ ...show, watching, disliked, liked, details, matchesService }];
    }).sort((a, b) => Number(b.matchesService) - Number(a.matchesService) ||
      a.disliked - b.disliked || Number(b.watching) - Number(a.watching) || b.liked - a.liked);
  }

  function artMarkup(url, title) {
    if (typeof url === "string" && /^\.\/artwork\/[a-z0-9-]+\.webp$/.test(url)) {
      return '<img draggable="false" alt="" src="' + url + '">';
    }
    return '<span class="art-placeholder" aria-hidden="true">' + escapeHTML(title) + '</span>';
  }

  function updateArtwork(changeFocus = false) {
    const images = current?.details?.artwork || [];
    const dots = get("artDots");
    get("pickArtwork").innerHTML = artMarkup(images[imageIndex], current.title);
    dots.hidden = images.length < 2;
    get("artPosition").textContent = dots.hidden ? "" : "Image " + (imageIndex + 1) + " of " + images.length;
    [...dots.children].forEach((dot, index) => {
      dot.setAttribute("aria-current", String(index === imageIndex));
    });
    if (changeFocus) dots.children[imageIndex]?.focus();
  }

  function showImage(index, changeFocus = false) {
    const count = current?.details?.artwork?.length || 0;
    if (count < 2) return;
    imageIndex = (index + count) % count;
    updateArtwork(changeFocus);
  }

  function renderTonight(preferredKey) {
    const session = evening();
    const available = candidates();
    const passed = new Set(session.passes.map(item => item.key));
    const last = session.passes.at(-1);
    const oldKey = current?.key;
    current = session.chosen
      ? available.find(show => show.key === session.chosen.key) || session.chosen
      : available.find(show => show.key === preferredKey && !passed.has(show.key)) ||
        available.find(show => !passed.has(show.key));
    if (oldKey !== current?.key) imageIndex = 0;
    if (imageIndex >= (current?.details?.artwork?.length || 0)) imageIndex = 0;

    get("tonightPick").hidden = !current;
    get("tonightActions").hidden = Boolean(session.chosen);
    get("passNotice").hidden = !last || Boolean(session.chosen);
    get("tonightEmpty").hidden = Boolean(current);
    get("browseFromTonight").hidden = Boolean(current);
    if (last) get("passText").textContent = "Passed on " + last.title;
    if (!current) {
      get("tonightEmpty").textContent = last ? "That’s all the picks for tonight." : "No unfinished picks on your shelf yet.";
      get("artPosition").textContent = "";
      return;
    }
    get("tonightTitle").textContent = current.title;
    get("tonightReason").textContent = session.chosen ? "You’re watching this tonight." : [
      current.watching ? "Pick up where you left off." : "A familiar pick from your shelf.",
      current.details?.service
    ].filter(Boolean).join(" · ");
    get("artDots").innerHTML = (current.details?.artwork || []).length > 1
      ? current.details.artwork.map((_, index) =>
        '<button type="button" data-image="' + index + '" aria-label="Show image ' + (index + 1) + '"></button>').join("")
      : "";
    updateArtwork();
  }

  async function renderBrowse() {
    const request = ++browseVersion;
    const query = get("familiarSearch").value.trim();
    const selected = services();
    const status = get("familiarStatus");
    const results = get("familiarResults");
    const saved = new Set(window.showShelf.getProfiles().flatMap(profile => profile.shows.map(show => titleKey(show.title))));
    get("startTonight").disabled = !saved.size;
    try {
      await loadCatalog();
      const matches = query ? await window.showCatalog.searchShows(query) : catalog.filter(show =>
        !selected.length ? show.artwork?.length : selected.includes(show.service || "Other"));
      if (request !== browseVersion) return;
      results.innerHTML = matches.map(show => {
        const added = saved.has(titleKey(show.title));
        const details = [show.service, show.kind === "channel" ? "Channel" : null].filter(Boolean).join(" · ");
        return '<button class="familiar-card" type="button" data-familiar="' + escapeHTML(show.id) + '"' +
          (added ? ' disabled' : '') + '><span class="familiar-art">' + artMarkup(show.artwork?.[0], show.title) +
          '</span><strong>' + escapeHTML(show.title) + '</strong><small>' + escapeHTML(details || "Show") +
          ' · ' + (added ? 'On shelf' : 'Add') + '</small></button>';
      }).join("");
      status.textContent = matches.length ? "Sample catalog · Availability may vary" : "No matching picks. Try searching by title.";
    } catch (_) {
      if (request !== browseVersion) return;
      results.innerHTML = "";
      status.textContent = "Could not load the sample catalog. Search again or add a title on the Shelf.";
    }
  }

  function open(next, focus = true) {
    view = next === "tonight" && !evening().chosen && !window.showShelf.getProfiles().some(profile => profile.shows.length)
      ? "browse" : next;
    for (const [name, element] of Object.entries(views)) element.hidden = name !== view;
    get("navTonight").setAttribute("aria-current", view !== "shelf" ? "page" : "false");
    get("navShelf").setAttribute("aria-current", view === "shelf" ? "page" : "false");
    if (view === "browse") renderBrowse();
    if (view === "tonight") {
      renderTonight();
      const key = current?.key;
      loadCatalog().then(() => {
        if (view === "tonight") renderTonight(current?.key || key);
      }).catch(() => {});
    }
    if (focus) {
      window.scrollTo(0, 0);
      const heading = view === "shelf" ? views.shelf.querySelector("h2") : get(view === "browse" ? "onboardingHeading" : "tonightHeading");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus();
    }
  }

  get("navTonight").addEventListener("click", () => open("tonight"));
  get("navShelf").addEventListener("click", () => open("shelf"));
  get("browseFromShelf").addEventListener("click", () => open("browse"));
  get("browseFromTonight").addEventListener("click", () => open("browse"));
  get("startTonight").addEventListener("click", () => open("tonight"));
  get("familiarSearch").addEventListener("input", renderBrowse);
  get("watchServices").addEventListener("change", () => {
    localStorage.setItem(serviceKey, JSON.stringify(services()));
    renderBrowse();
  });
  get("familiarResults").addEventListener("click", async event => {
    const button = event.target.closest("button[data-familiar]");
    if (!button) return;
    const show = catalog.find(item => item.id === button.dataset.familiar);
    if (!show) return;
    const category = show.genres.find(genre => ["Animation", "Adventure", "Comedy", "Educational", "Nature", "Fantasy"].includes(genre)) || "Other";
    const result = window.showShelf.addShow({ title: show.title, category });
    if (result.added) {
      await renderBrowse();
      get("familiarStatus").textContent = "Added " + show.title + " to the shelf.";
      get("startTonight").focus({ preventScroll: true });
    }
  });
  get("passTonight").addEventListener("click", () => {
    const session = evening();
    if (!current || session.chosen) return;
    session.passes.push({ key: current.key, title: current.title });
    saveEvening(session);
    renderTonight();
    if (!current) get("undoPass").focus();
  });
  get("undoPass").addEventListener("click", () => {
    const session = evening();
    const undone = session.passes.pop();
    if (!undone) return;
    saveEvening(session);
    renderTonight(undone.key);
    if (current) get("passTonight").focus();
  });
  get("watchTonight").addEventListener("click", () => {
    const session = evening();
    if (!current || session.chosen) return;
    session.chosen = { key: current.key, title: current.title };
    saveEvening(session);
    renderTonight();
    get("tonightHeading").focus();
  });

  get("artDots").addEventListener("click", event => {
    const dot = event.target.closest("button[data-image]");
    if (dot) showImage(Number(dot.dataset.image));
  });
  get("artDots").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    showImage(imageIndex + (event.key === "ArrowLeft" ? -1 : 1), true);
  });
  const artwork = get("pickArtwork");
  artwork.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    dragStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    artwork.setPointerCapture(event.pointerId);
  });
  artwork.addEventListener("pointercancel", () => { dragStart = null; });
  artwork.addEventListener("pointerup", event => {
    if (event.pointerId !== dragStart?.id) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    dragStart = null;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) showImage(imageIndex + (dx < 0 ? 1 : -1));
  });
  open("tonight", false);
})();

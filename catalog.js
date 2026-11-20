(function () {
  const catalogUrl = "./catalog.json";
  let cachedCatalog;
  function normalizeId(id) {
    if (Number.isSafeInteger(id)) return String(id);
    if (typeof id !== "string") return null;
    const trimmed = id.trim();
    // Control characters cannot reliably round-trip through HTML data attributes.
    return trimmed && !/[\u0000-\u001f\u007f]/.test(trimmed) ? trimmed : null;
  }

  async function loadCatalog() {
    if (cachedCatalog) return cachedCatalog;
    const response = await fetch(catalogUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("The sample catalog could not be loaded.");
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("The sample catalog has an invalid format.");

    const shows = [];
    const seenIds = new Set();
    for (const show of data) {
      const id = normalizeId(show?.id);
      const title = typeof show?.title === "string" ? show.title.trim() : "";
      if (id === null || !title || seenIds.has(id)) continue;
      seenIds.add(id);
      const genres = Array.isArray(show.genres)
        ? show.genres.filter(genre => typeof genre === "string").map(genre => genre.trim()).filter(Boolean)
        : [];
      shows.push({
        ...show,
        id,
        title,
        overview: typeof show.overview === "string" ? show.overview : "",
        genres
      });
    }
    // Keep the first successful result if concurrent requests finish out of order.
    return cachedCatalog ??= shows;
  }

  window.showCatalog = {
    async searchShows(query) {
      const term = String(query || "").trim().toLocaleLowerCase();
      if (!term) return [];
      const shows = await loadCatalog();
      return shows.filter(show =>
        show.title.toLocaleLowerCase().includes(term) ||
        show.overview.toLocaleLowerCase().includes(term) ||
        show.genres.some(genre => genre.toLocaleLowerCase().includes(term))
      ).slice(0, 12);
    },
    async getShowDetails(id) {
      const key = normalizeId(id);
      if (key === null) return null;
      const shows = await loadCatalog();
      return shows.find(show => show.id === key) || null;
    }
  };
})();

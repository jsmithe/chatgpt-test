(function () {
  const catalogUrl = "./catalog.json";
  let cachedCatalog;
  async function loadCatalog() {
    if (!cachedCatalog) {
      const response = await fetch(catalogUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("The sample catalog could not be loaded.");
      cachedCatalog = await response.json();
      if (!Array.isArray(cachedCatalog)) throw new Error("The sample catalog has an invalid format.");
    }
    return cachedCatalog;
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
      const shows = await loadCatalog();
      return shows.find(show => show.id === id) || null;
    }
  };
})();

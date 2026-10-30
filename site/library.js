/* Browser-only library browsing. Works without a backend or personal-data storage. */
(() => {
  "use strict";
  const library = document.getElementById("library");
  if (!library) return;
  const cards = Array.from(library.querySelectorAll(".vid[data-type]"));
  const tabs = Array.from(library.querySelectorAll("[data-filter]"));
  const search = document.getElementById("video-search");
  const count = document.getElementById("video-count");
  const more = document.getElementById("load-more");
  const empty = document.getElementById("empty-state");
  if (!cards.length || !search || !count || !more || !empty || !tabs.length) return;

  let type = "all";
  let limit = 9;
  const PAGE = 9;
  const normalize = input => String(input || "").toLocaleLowerCase().trim();

  function update() {
    const query = normalize(search.value);
    const matching = cards.filter(card =>
      (type === "all" || card.dataset.type === type || card.dataset.scope === type) &&
      normalize(card.dataset.search).includes(query)
    );
    const visible = new Set(matching.slice(0, limit));
    for (const card of cards) card.hidden = !visible.has(card);
    count.textContent = query
      ? "Showing " + visible.size + " of " + matching.length + " matching videos"
      : "Showing " + visible.size + " of " + matching.length + " videos";
    empty.hidden = matching.length !== 0;
    more.hidden = matching.length <= limit;
    if (!more.hidden) more.textContent = "Show more videos (" + (matching.length - limit) + " remaining)";
    for (const button of tabs) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === type));
    }
  }

  for (const button of tabs) {
    button.addEventListener("click", () => {
      type = button.dataset.filter;
      limit = PAGE;
      update();
    });
  }
  search.addEventListener("input", () => {
    limit = PAGE;
    update();
  });
  more.addEventListener("click", () => {
    limit += PAGE;
    update();
  });
  update();
})();

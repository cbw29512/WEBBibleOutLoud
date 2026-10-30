/* Local-only video library: newest uploads default, canonical Bible order in topic tabs. */
(() => {
  "use strict";
  const library = document.getElementById("library");
  const grid = document.getElementById("video-grid");
  if (!library || !grid) return;
  const cards = Array.from(grid.querySelectorAll(".vid[data-type]"));
  const tabs = Array.from(library.querySelectorAll("[data-filter]"));
  const search = document.getElementById("video-search");
  const count = document.getElementById("video-count");
  const more = document.getElementById("load-more");
  const empty = document.getElementById("empty-state");
  const picker = document.getElementById("book-picker");
  const pickerWrap = document.getElementById("book-picker-wrap");
  const storiesHelp = document.getElementById("stories-help");
  const sortLabel = document.getElementById("sort-label");
  if (!cards.length || !search || !count || !more || !empty || !tabs.length ||
      !picker || !pickerWrap || !storiesHelp || !sortLabel) return;

  let type = "all";
  let appliedOrder = "all";
  let limit = 9;
  const PAGE = 9;
  const normalize = text => String(text || "").toLocaleLowerCase().trim();
  const bibleRank = card => Number(card.dataset.scriptureOrder);
  const dateRank = card => Number(card.dataset.published);
  function update() {
    const query = normalize(search.value);
    const bibleOrder = type !== "all";
    // The static HTML is already newest-first. Avoid 71 unnecessary DOM moves on
    // initial load, search keystrokes, and pagination to protect responsiveness.
    if (type !== appliedOrder) {
      const ordered = [...cards].sort((a, b) =>
        bibleOrder
          ? bibleRank(a) - bibleRank(b) || dateRank(a) - dateRank(b)
          : dateRank(b) - dateRank(a)
      );
      const fragment = document.createDocumentFragment();
      for (const card of ordered) fragment.appendChild(card);
      grid.appendChild(fragment);
      appliedOrder = type;
    }
    const matching = Array.from(grid.children).filter(card => {
      const category = type === "all" ||
        (type === "stories" ? card.dataset.story === "yes" :
          card.dataset.type === type || card.dataset.scope === type);
      const selectedBook = type !== "book" || picker.value === "all" ||
        card.dataset.book === picker.value;
      return category && selectedBook && normalize(card.dataset.search).includes(query);
    });
    const visible = new Set(matching.slice(0, limit));
    for (const card of cards) card.hidden = !visible.has(card);
    count.textContent = query
      ? "Showing " + visible.size + " of " + matching.length + " matching videos"
      : "Showing " + visible.size + " of " + matching.length + " videos";
    empty.hidden = matching.length > 0;
    more.hidden = matching.length <= limit;
    if (!more.hidden) more.textContent = "Show more videos (" + (matching.length - limit) + " remaining)";
    pickerWrap.hidden = type !== "book";
    storiesHelp.hidden = type !== "stories";
    sortLabel.textContent = bibleOrder ? "Bible order" : "Newest uploads first";
    for (const button of tabs) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === type));
    }
  }
  for (const button of tabs) {
    button.addEventListener("click", () => {
      type = button.dataset.filter;
      limit = PAGE;
      picker.value = "all";
      update();
    });
  }
  picker.addEventListener("change", () => {
    limit = PAGE;
    update();
  });
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

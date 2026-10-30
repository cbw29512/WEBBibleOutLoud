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
  const storiesHelp = document.getElementById("stories-help");
  const storyContainer = document.getElementById("story-collections");
  const storyGroups = Array.from(storyContainer?.querySelectorAll(".story-collection") || []);
  const sortLabel = document.getElementById("sort-label");
  if (!cards.length || !search || !count || !more || !empty || !tabs.length ||
      !storiesHelp || !sortLabel || !storyContainer || !storyGroups.length) return;

  // State: one validated collection, a nine-card page, and one active sorting mode.
  // The "view" URL parameter makes category links bookmarkable and shareable.
  const VIEWS = new Set(["all", "short", "book", "passage", "stories"]);
  const PAGE = 9;
  let type = "all";
  let appliedOrder = "all";
  let limit = PAGE;
  const normalize = text => String(text || "").toLocaleLowerCase().trim();
  const bibleRank = card => Number(card.dataset.scriptureOrder);
  const dateRank = card => Number(card.dataset.published);

  function readView() {
    try {
      const requested = new URLSearchParams(window.location.search).get("view");
      return requested && VIEWS.has(requested) ? requested : "all";
    } catch (error) {
      console.warn("Could not read the requested Bible collection", error);
      return "all";
    }
  }
  type = readView();

  function update() {
    const query = normalize(search.value);
    const isStoryView = type === "stories";
    grid.hidden = isStoryView;
    storyContainer.hidden = !isStoryView;
    storiesHelp.hidden = !isStoryView;

    // Story state is grouped by title; a matching story retains all of its
    // published parts rather than hiding individual clips during a search.
    if (isStoryView) {
      const matching = storyGroups.filter(group =>
        normalize(group.dataset.storySearch).includes(query));
      const visible = new Set(matching);
      for (const group of storyGroups) group.hidden = !visible.has(group);
      const clips = matching.reduce((total, group) =>
        total + group.querySelectorAll(".story-clip-link").length, 0);
      count.textContent = "Showing " + matching.length + " of " +
        storyGroups.length + " stories · " + clips + " clips";
      empty.hidden = matching.length > 0;
      more.hidden = true;
      sortLabel.textContent = "Scripture order";
      for (const button of tabs) {
        button.setAttribute("aria-pressed", String(button.dataset.filter === type));
      }
      return;
    }
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
      return category && normalize(card.dataset.search).includes(query);
    });
    const visible = new Set(matching.slice(0, limit));
    for (const card of cards) card.hidden = !visible.has(card);
    count.textContent = query
      ? "Showing " + visible.size + " of " + matching.length + " matching videos"
      : "Showing " + visible.size + " of " + matching.length + " videos";
    empty.hidden = matching.length > 0;
    more.hidden = matching.length <= limit;
    if (!more.hidden) more.textContent = "Show more videos (" + (matching.length - limit) + " remaining)";
    sortLabel.textContent = bibleOrder ? "Bible order" : "Newest uploads first";
    for (const button of tabs) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === type));
    }
  }
  function selectView(next, keepInHistory) {
    if (!VIEWS.has(next)) return;
    type = next;
    limit = PAGE;
    if (keepInHistory && /^https?:$/.test(window.location.protocol)) {
      try {
        const url = new URL(window.location.href);
        if (next === "all") url.searchParams.delete("view");
        else url.searchParams.set("view", next);
        window.history.pushState(null, "", url);
      } catch (error) {
        // Never block browsing because the browser rejected a history update.
        console.warn("Could not save the Bible collection in the URL", error);
      }
    }
    update();
  }
  for (const button of tabs) {
    button.addEventListener("click", () => selectView(button.dataset.filter, true));
  }
  window.addEventListener("popstate", () => selectView(readView(), false));
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

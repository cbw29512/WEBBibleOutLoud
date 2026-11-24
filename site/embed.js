// Click-to-load YouTube player (privacy-enhanced youtube-nocookie.com). Nothing loads from YouTube until the visitor presses play.
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest(".lite-play"); if (!b) return;
  var box = b.parentElement, id = box.getAttribute("data-id");
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
  var f = document.createElement("iframe");
  f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
  f.title = box.getAttribute("data-title") || "YouTube video";
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
  f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  box.replaceChildren(f); box.classList.add("is-playing"); f.focus();
});

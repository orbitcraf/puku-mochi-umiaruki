"use strict";

const CHARACTER_STATES = {
  puku: [
    { image: "assets/puku-1.png", alt: "元気に手を振るぷく", quote: "「いくぞー！」" },
    { image: "assets/puku-2.png", alt: "大きくジャンプするぷく", quote: "「ぴょーん！」" },
    { image: "assets/puku-3.png", alt: "虫眼鏡で何かを見つけたぷく", quote: "「みつけた！」" },
    { image: "assets/puku-4.png", alt: "おにぎりを食べるぷく", quote: "「おいしい！」" }
  ],
  mochi: [
    { image: "assets/mochi-1.png", alt: "のんびり立っているもち", quote: "「ゆっくりね」" },
    { image: "assets/mochi-2.png", alt: "ちょこんと座るもち", quote: "「ちょっと やすむ…」" },
    { image: "assets/mochi-3.png", alt: "気持ちよさそうに眠るもち", quote: "「すぅ…」" },
    { image: "assets/mochi-4.png", alt: "景色をゆっくり見るもち", quote: "「まだ のぼるの？」" }
  ]
};

const SCENES = {
  departure: { reaction: "草が さわさわ。" },
  forest: { reaction: "ことりが ぴゅーん！" },
  river: { reaction: "川が きらり。" },
  slope: { reaction: "小石が ころころ ころん。" },
  rest: { reaction: "いい かぜ〜。" },
  snack: { reaction: "おにぎりが きらり。" },
  summit: { reaction: "やっほー！" },
  sunset: { reaction: "夕空が きらり。" }
};

const EFFECTS = {
  grass: ["〽", "❋", "〽"],
  bird: ["⌁", "♪", "⌁"],
  river: ["○", "◌", "✦"],
  pebble: ["●", "•", "·"],
  wind: ["〜", "﹏", "〜"],
  snack: ["🍙", "✦", "♡"],
  cheer: ["!", "★", "!"],
  sunset: ["♥", "✦", "·"]
};

const ALBUM_ITEMS = [
  { image: "assets/story-2.jpg", alt: "森を歩くぷくともち", title: "森の におい", description: "葉っぱのすきまから、まるい光がたくさん落ちてきました。" },
  { image: "assets/story-3.jpg", alt: "川を渡るぷくともち", title: "川は きらきら", description: "ぷくは三歩で、もちは七歩で。冷たい水を渡りました。" },
  { image: "assets/story-5.jpg", alt: "休憩するぷくともち", title: "ひとやすみ", description: "急がない時間も、山あるきの大切な思い出です。" },
  { image: "assets/story-6.jpg", alt: "おにぎりを食べるぷくともち", title: "いちばんの ごちそう", description: "たくさん歩いたあとのおにぎりは、いつもより大きな味。" },
  { image: "assets/story-7.jpg", alt: "山頂で喜ぶぷくともち", title: "てっぺん！", description: "違う歩き方でも、ふたりで同じ景色に会えました。" },
  { image: "assets/story-8.jpg", alt: "夕焼けを見るぷくともち", title: "ふたりの ゆうやけ", description: "しずかな空を、ことばにしないで眺めました。" }
];

const pages = [...document.querySelectorAll(".book-page")];
const pageIndexById = new Map(pages.map((page, index) => [page.dataset.pageId, index]));
const viewport = document.getElementById("book-viewport");
const previousButton = document.getElementById("page-prev");
const nextButton = document.getElementById("page-next");
const pageStatus = document.getElementById("page-status");
const pageDots = document.getElementById("page-dots");
const pageAnnouncement = document.getElementById("page-announcement");
const reactionOutput = document.getElementById("scene-reaction");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentPageIndex = 0;
let transitionTimer = 0;
let isTransitioning = false;
let queuedHistoryIndex = null;

function pageIdFromHash() {
  const value = decodeURIComponent(window.location.hash.replace(/^#page-/, ""));
  return pageIndexById.has(value) ? value : null;
}

function pageTitle(page) {
  return page.querySelector("[data-page-title]")?.textContent.trim().replace(/\s+/g, " ") || "ページ";
}

function setPageAccessibility(activeIndex) {
  pages.forEach((page, index) => {
    const active = index === activeIndex;
    page.setAttribute("aria-hidden", String(!active));
    page.inert = !active;
  });
}

function updateNavigation() {
  const total = pages.length;
  previousButton.disabled = currentPageIndex === 0;
  nextButton.disabled = currentPageIndex === total - 1;
  pageStatus.textContent = `${currentPageIndex + 1} / ${total}`;
  previousButton.setAttribute("aria-label", currentPageIndex > 0 ? `前のページ、${pageTitle(pages[currentPageIndex - 1])}へ` : "前のページはありません");
  nextButton.setAttribute("aria-label", currentPageIndex < total - 1 ? `次のページ、${pageTitle(pages[currentPageIndex + 1])}へ` : "次のページはありません");
  [...pageDots.children].forEach((dot, index) => dot.classList.toggle("is-current", index === currentPageIndex));
}

function updateSceneSound() {
  const scene = pages[currentPageIndex].dataset.scene || "departure";
  window.bookSound?.setScene(scene);
}

function preloadNearbyImages(index) {
  [index - 1, index, index + 1].forEach((nearbyIndex) => {
    const page = pages[nearbyIndex];
    if (!page) return;
    page.querySelectorAll("img").forEach((image) => {
      image.loading = "eager";
      if (!image.complete) {
        const preload = new Image();
        preload.src = image.currentSrc || image.src;
      }
    });
  });
}

function updateUrl(index, replace = false) {
  const url = `#page-${pages[index].dataset.pageId}`;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({ page: pages[index].dataset.pageId }, "", url);
}

function finishTransition(oldPage, newPage, focusTitle) {
  oldPage?.classList.remove("is-leaving", "is-leaving-next", "is-leaving-prev");
  newPage.classList.remove("is-entering", "is-entering-next", "is-entering-prev");
  isTransitioning = false;
  if (focusTitle) newPage.querySelector("[data-page-title]")?.focus({ preventScroll: true });
  if (queuedHistoryIndex !== null && queuedHistoryIndex !== currentPageIndex) {
    const queuedIndex = queuedHistoryIndex;
    queuedHistoryIndex = null;
    goToPage(queuedIndex, { history: "none", focus: false });
  } else {
    queuedHistoryIndex = null;
  }
}

function goToPage(index, options = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= pages.length || index === currentPageIndex) return;
  if (isTransitioning) {
    if (options.fromHistory) queuedHistoryIndex = index;
    return;
  }

  const oldIndex = currentPageIndex;
  const oldPage = pages[oldIndex];
  const newPage = pages[index];
  const direction = index > oldIndex ? "next" : "prev";
  isTransitioning = true;

  oldPage.classList.remove("is-active");
  oldPage.classList.add("is-leaving", `is-leaving-${direction}`);
  newPage.classList.add("is-active", "is-entering", `is-entering-${direction}`);
  currentPageIndex = index;
  setPageAccessibility(index);
  updateNavigation();
  preloadNearbyImages(index);
  updateSceneSound();

  if (options.history !== "none") updateUrl(index, options.history === "replace");
  pageAnnouncement.textContent = `${index + 1}ページ、${pageTitle(newPage)}`;

  window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(
    () => finishTransition(oldPage, newPage, options.focus !== false),
    reducedMotion.matches ? 20 : 380
  );
}

function syncPageFromUrl() {
  const id = pageIdFromHash();
  if (id === null) {
    if (currentPageIndex === 0) updateUrl(0, true);
    else goToPage(0, { history: "replace", focus: false, fromHistory: true });
    return;
  }
  const index = pageIndexById.get(id);
  if (index !== currentPageIndex) goToPage(index, { history: "none", focus: false, fromHistory: true });
}

function initializeBook() {
  document.querySelectorAll(".book-page img").forEach((image) => { image.draggable = false; });
  pageDots.replaceChildren(...pages.map(() => document.createElement("i")));
  const requestedId = pageIdFromHash();
  const initialIndex = requestedId === null ? 0 : pageIndexById.get(requestedId);
  pages.forEach((page, index) => page.classList.toggle("is-active", index === initialIndex));
  currentPageIndex = initialIndex;
  setPageAccessibility(initialIndex);
  updateNavigation();
  preloadNearbyImages(initialIndex);
  updateSceneSound();
  if (window.location.hash !== `#page-${pages[initialIndex].dataset.pageId}`) updateUrl(initialIndex, true);
}

previousButton.addEventListener("click", () => goToPage(currentPageIndex - 1));
nextButton.addEventListener("click", () => goToPage(currentPageIndex + 1));
document.querySelectorAll("[data-go-next]").forEach((button) => button.addEventListener("click", () => goToPage(currentPageIndex + 1)));
document.querySelectorAll("[data-go-page]").forEach((button) => button.addEventListener("click", () => goToPage(pageIndexById.get(button.dataset.goPage))));
window.addEventListener("popstate", syncPageFromUrl);
window.addEventListener("hashchange", syncPageFromUrl);

document.addEventListener("keydown", (event) => {
  if (document.getElementById("album-dialog")?.open || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "ArrowRight") { event.preventDefault(); goToPage(currentPageIndex + 1); }
  if (event.key === "ArrowLeft") { event.preventDefault(); goToPage(currentPageIndex - 1); }
  if (event.key === "Home") { event.preventDefault(); goToPage(0); }
  if (event.key === "End") { event.preventDefault(); goToPage(pages.length - 1); }
});

let swipeStart = null;
viewport.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0 || event.target.closest("button, a, dialog, [data-no-swipe]")) return;
  swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
viewport.addEventListener("pointercancel", () => { swipeStart = null; });
viewport.addEventListener("pointerup", (event) => {
  if (!swipeStart || swipeStart.id !== event.pointerId) return;
  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;
  goToPage(currentPageIndex + (deltaX < 0 ? 1 : -1));
});

document.querySelectorAll("[data-character]").forEach((card) => {
  const name = card.dataset.character;
  const states = CHARACTER_STATES[name];
  const image = card.querySelector("[data-character-image]");
  const quote = card.querySelector("[data-character-quote]");
  const speech = card.querySelector("[data-character-speech]");
  let stateIndex = 0;
  let changeTimer;

  card.addEventListener("click", () => {
    stateIndex = (stateIndex + 1) % states.length;
    const state = states[stateIndex];
    window.clearTimeout(changeTimer);
    card.classList.remove("is-changing", "is-sleeping");
    speech.classList.remove("is-speaking");
    void card.offsetWidth;
    if (name === "puku") card.classList.add("is-changing");
    if (name === "mochi" && stateIndex === 2) card.classList.add("is-sleeping");
    image.style.opacity = "0";
    changeTimer = window.setTimeout(() => {
      image.src = state.image;
      image.alt = state.alt;
      quote.textContent = state.quote;
      speech.textContent = state.quote.replace(/[「」]/g, "");
      image.style.opacity = "1";
      speech.classList.add("is-speaking");
      if (name === "puku") window.bookSound?.chirp();
    }, name === "puku" ? 70 : 330);
  });
});

document.querySelectorAll(".scene-touch").forEach((button) => {
  button.addEventListener("click", () => {
    const effect = button.dataset.effect;
    const imageArea = button.closest(".illustration-leaf");
    const symbols = EFFECTS[effect];
    for (let index = 0; index < 7; index += 1) {
      const particle = document.createElement("span");
      particle.className = "effect-particle";
      particle.textContent = symbols[index % symbols.length];
      particle.style.setProperty("--x", `${18 + Math.random() * 64}%`);
      particle.style.setProperty("--y", `${48 + Math.random() * 34}%`);
      particle.style.setProperty("--size", `${1 + Math.random() * 1.2}rem`);
      particle.style.setProperty("--drift", `${-45 + Math.random() * 90}px`);
      particle.style.setProperty("--spin", `${-25 + Math.random() * 50}deg`);
      imageArea.appendChild(particle);
      window.setTimeout(() => particle.remove(), 1450);
    }
    const sceneName = button.closest("[data-scene]").dataset.scene;
    reactionOutput.textContent = SCENES[sceneName].reaction;
    if (effect === "bird") window.bookSound?.chirp();
    if (effect === "river") window.bookSound?.splash();
    if (["grass", "pebble", "wind"].includes(effect)) window.bookSound?.step();
  });
});

const dialog = document.getElementById("album-dialog");
const albumOpen = document.getElementById("album-open");
const dialogImage = document.getElementById("dialog-image");
const dialogTitle = document.getElementById("dialog-title");
const dialogDescription = document.getElementById("dialog-description");
const dialogCount = document.getElementById("dialog-count");
const albumButtons = [...document.querySelectorAll("[data-album-index]")];

function selectAlbumItem(index) {
  const item = ALBUM_ITEMS[index];
  dialogImage.src = item.image;
  dialogImage.alt = item.alt;
  dialogTitle.textContent = item.title;
  dialogDescription.textContent = item.description;
  dialogCount.textContent = `${index + 1} / ${ALBUM_ITEMS.length}`;
  albumButtons.forEach((button, buttonIndex) => {
    if (buttonIndex === index) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
}

albumOpen.addEventListener("click", () => {
  selectAlbumItem(0);
  dialog.showModal();
});
albumButtons.forEach((button) => button.addEventListener("click", () => selectAlbumItem(Number(button.dataset.albumIndex))));
dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) dialog.close();
});
dialog.addEventListener("close", () => albumOpen.focus());

initializeBook();

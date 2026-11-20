/* =========================================================
   Pixora — main script
   Features:
   - 10 categories (chips with counts) + live search + sorting
   - 9 photo effects (CSS filters) applied everywhere
   - Favourites (saved in the browser) with a "Favourites only" view
   - "Load more" pagination and two grid sizes
   - Lightbox: next/prev, thumbnails, counter, double-click zoom,
     slideshow with progress bar, fullscreen, source link
   - Keyboard: ← → Esc Space F L Home End, "/" to search
   - Touch swipe, light/dark theme, back-to-top, toasts
   ========================================================= */

(() => {
  "use strict";

  /* ---------- Settings ---------- */
  const PAGE_SIZE   = 24;    // photos shown per "page"
  const SLIDE_DELAY = 3500;  // ms per slide in slideshow mode
  const LAYOUT = ["wide", "", "tall", "", "", "", "tall", "", "wide", "", "", "tall"]; // grid rhythm

  // One soft colour per category (used for chips, card glow, tags)
  const CAT_COLORS = {
    "All":          "#9c8ff8",
    "Landscapes":   "#34c3b2",
    "Mountains":    "#5aa9ef",
    "Beaches":      "#f3b65b",
    "Wildlife":     "#f2877a",
    "Birds":        "#e27bb4",
    "Flowers":      "#c58af0",
    "Architecture": "#8b7cf6",
    "Cityscapes":   "#4f8cf0",
    "Food":         "#f29b56",
    "Night Sky":    "#7f88f5"
  };
  const colorOf = (cat) => CAT_COLORS[cat] || "#9c8ff8";

  /* ---------- Helpers ---------- */
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const keyOf = (p) => `${p.category}-${p.photo ?? p.src ?? p.title}`;

  // Build an Unsplash image URL at a given size (or use your own `src`).
  // Height 0 = keep the original proportions (used in the lightbox).
  const imgUrl = (p, w, h = 0) => {
    if (p.src) return p.src;
    const size = h ? `&h=${h}&fit=crop&crop=entropy` : "&fit=max";
    return `https://images.unsplash.com/${p.photo}?w=${w}${size}&auto=format&q=75`;
  };

  // Backup: the same photo at a plain size, in case a sized request fails
  const fallbackUrl = (p) => (p.src ? p.src : `https://images.unsplash.com/${p.photo}?w=1080&auto=format`);

  const sourceOf = (p) => p.source || imgUrl(p, 1600);

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const storage = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }
  };

  const HEART = `<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6C19.5 15.9 12 20.5 12 20.5z"/></svg>`;

  /* ---------- Elements ---------- */
  const gallery      = $("#gallery");
  const chipsWrap    = $("#categoryChips");
  const searchInput  = $("#searchInput");
  const effectSelect = $("#effectSelect");
  const sortSelect   = $("#sortSelect");
  const resultCount  = $("#resultCount");
  const emptyState   = $("#emptyState");
  const emptyTitle   = $("#emptyTitle");
  const emptyText    = $("#emptyText");
  const resetBtn     = $("#resetBtn");
  const loadMoreBtn  = $("#loadMoreBtn");
  const themeToggle  = $("#themeToggle");
  const favToggle    = $("#favToggle");
  const favCount     = $("#favCount");
  const toolbarWrap  = $(".toolbar-wrap");
  const toTop        = $("#toTop");
  const toast        = $("#toast");

  const lightbox   = $("#lightbox");
  const lbImage    = $("#lbImage");
  const lbWrap     = $("#lbWrap");
  const lbTitle    = $("#lbTitle");
  const lbDesc     = $("#lbDesc");
  const lbTag      = $("#lbTag");
  const lbCounter  = $("#lbCounter");
  const lbThumbs   = $("#lbThumbs");
  const lbPrev     = $("#lbPrev");
  const lbNext     = $("#lbNext");
  const lbPlay     = $("#lbPlay");
  const lbFull     = $("#lbFullscreen");
  const lbFav      = $("#lbFav");
  const lbSource   = $("#lbSource");
  const lbClose    = $("#lbClose");
  const lbProgress = $("#lbProgress");

  /* ---------- State ---------- */
  const state = {
    category: "All",
    query: "",
    sort: "default",
    effect: "none",
    favOnly: false,
    favs: new Set(storage.get("pixora-favs", [])),
    order: PHOTOS.map((_, i) => i), // used for shuffle
    visible: [],
    shown: PAGE_SIZE,
    index: 0,
    playing: false,
    timer: null,
    lastFocus: null
  };

  /* =========================================================
     Theme
     ========================================================= */
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  setTheme(storage.get("pixora-theme") || (prefersLight ? "light" : "dark"));

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#11121f" : "#f7f4fb");
    storage.set("pixora-theme", theme);
  }

  themeToggle.addEventListener("click", () =>
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  /* =========================================================
     Toast
     ========================================================= */
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  /* =========================================================
     Category chips
     ========================================================= */
  const categories = ["All", ...new Set(PHOTOS.map((p) => p.category))];
  $("#statPhotos").textContent = PHOTOS.length;
  $("#statCats").textContent = categories.length - 1;

  function buildChips() {
    chipsWrap.innerHTML = categories.map((cat) => {
      const count = cat === "All" ? PHOTOS.length : PHOTOS.filter((p) => p.category === cat).length;
      const active = cat === state.category;
      return `<button class="chip${active ? " active" : ""}" role="tab" style="--c:${colorOf(cat)}"
                aria-selected="${active}" data-category="${escapeHtml(cat)}">
                ${escapeHtml(cat)}<span class="count">${count}</span>
              </button>`;
    }).join("");
  }

  chipsWrap.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.category;
    buildChips();
    $(".chip.active")?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    render();
  });

  /* =========================================================
     Search, effects, sort, density, favourites filter
     ========================================================= */
  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = searchInput.value.trim().toLowerCase();
      render();
    }, 180);
  });

  effectSelect.addEventListener("change", () => {
    document.body.classList.remove(`fx-${state.effect}`);
    state.effect = effectSelect.value;
    if (state.effect !== "none") document.body.classList.add(`fx-${state.effect}`);
    showToast(`Effect: ${effectSelect.selectedOptions[0].text}`);
  });

  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    if (state.sort === "shuffle") {
      // Fisher–Yates shuffle
      const o = state.order;
      for (let i = o.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [o[i], o[j]] = [o[j], o[i]];
      }
    }
    render();
  });

  const savedDensity = storage.get("pixora-density", "comfy");
  setDensity(savedDensity);
  function setDensity(d) {
    gallery.classList.toggle("compact", d === "compact");
    $$(".density-btn").forEach((b) => {
      const on = b.dataset.density === d;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    storage.set("pixora-density", d);
  }
  $(".density").addEventListener("click", (e) => {
    const b = e.target.closest(".density-btn");
    if (b) setDensity(b.dataset.density);
  });

  favToggle.addEventListener("click", () => {
    state.favOnly = !state.favOnly;
    favToggle.setAttribute("aria-pressed", state.favOnly);
    render();
    window.scrollTo({ top: $(".hero").offsetHeight - 20, behavior: "smooth" });
  });

  resetBtn.addEventListener("click", () => {
    state.category = "All";
    state.query = "";
    state.favOnly = false;
    favToggle.setAttribute("aria-pressed", "false");
    searchInput.value = "";
    buildChips();
    render();
    searchInput.focus();
  });

  /* =========================================================
     Favourites
     ========================================================= */
  function updateFavCount(animate) {
    favCount.textContent = state.favs.size;
    if (animate) {
      favCount.classList.remove("bump");
      void favCount.offsetWidth;
      favCount.classList.add("bump");
    }
  }

  function toggleFav(p) {
    const k = keyOf(p);
    const added = !state.favs.has(k);
    added ? state.favs.add(k) : state.favs.delete(k);
    storage.set("pixora-favs", [...state.favs]);
    updateFavCount(true);
    showToast(added ? `Added “${p.title}” to favourites` : `Removed “${p.title}” from favourites`);

    // Sync any heart buttons for this photo
    $$(`.fav-btn[data-key="${CSS.escape(k)}"]`).forEach((b) => setHeart(b, added, true));
    if (!lightbox.hidden && keyOf(state.visible[state.index]) === k) setLbFav(added);
    return added;
  }

  function setHeart(btn, on, animate) {
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on);
    btn.setAttribute("aria-label", on ? "Remove from favourites" : "Add to favourites");
    if (animate) { btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
  }

  /* =========================================================
     Gallery rendering
     ========================================================= */
  function getPhotos() {
    let list = state.order.map((i) => PHOTOS[i]).filter((p) => {
      const inCategory = state.category === "All" || p.category === state.category;
      const haystack = `${p.title} ${p.desc} ${p.category}`.toLowerCase();
      const inFavs = !state.favOnly || state.favs.has(keyOf(p));
      return inCategory && inFavs && (!state.query || haystack.includes(state.query));
    });

    if (state.sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    if (state.sort === "za") list.sort((a, b) => b.title.localeCompare(a.title));
    return list;
  }

  function render() {
    state.visible = getPhotos();
    state.shown = PAGE_SIZE;

    const total = state.visible.length;
    const where = state.favOnly ? " in your favourites"
                : state.category !== "All" ? ` in ${escapeHtml(state.category)}` : "";
    resultCount.innerHTML = total
      ? `Showing <strong>${total}</strong> photo${total === 1 ? "" : "s"}${where}`
      : "";

    emptyState.hidden = total > 0;
    if (!total) {
      const noFavs = state.favOnly && state.favs.size === 0;
      emptyTitle.textContent = noFavs ? "No favourites yet" : "No photos found";
      emptyText.textContent  = noFavs ? "Tap the heart on any photo to save it here."
                                      : "Try a different search term or category.";
    }

    gallery.innerHTML = "";
    appendCards(0, Math.min(state.shown, total));
    updateLoadMore();
  }

  function appendCards(from, to) {
    const total = state.visible.length;
    const html = state.visible.slice(from, to).map((p, n) => {
      const i = from + n;
      const size = total > 4 ? LAYOUT[i % LAYOUT.length] : "";
      const [w, h] = size === "tall" ? [600, 900] : size === "wide" ? [1000, 640] : [640, 480];
      const fav = state.favs.has(keyOf(p));
      const title = escapeHtml(p.title);
      return `
        <li class="card ${size}" style="--c:${colorOf(p.category)};animation-delay:${Math.min(n * 40, 480)}ms">
          <button class="card-btn" data-index="${i}" aria-label="Open ${title}">
            <img class="fx-target" src="${imgUrl(p, w, h)}" data-fallback="${fallbackUrl(p)}"
                 alt="${title} — ${escapeHtml(p.desc)}" loading="lazy" decoding="async" />
            <span class="zoom-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </span>
            <span class="card-overlay">
              <span class="tag">${escapeHtml(p.category)}</span>
              <h3>${title}</h3>
            </span>
          </button>
          <button class="fav-btn${fav ? " on" : ""}" data-key="${escapeHtml(keyOf(p))}" data-index="${i}"
                  aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Add to"} favourites">${HEART}</button>
        </li>`;
    }).join("");

    gallery.insertAdjacentHTML("beforeend", html);

    // Fade images in once loaded; swap to the backup if one fails
    $$(".card-btn:not(.wired) img", gallery).forEach((img) => {
      const btn = img.parentElement;
      btn.classList.add("wired");
      const markLoaded = () => btn.classList.add("loaded");
      if (img.complete && img.naturalWidth) markLoaded();
      img.addEventListener("load", markLoaded);
      img.addEventListener("error", () => {
        if (img.dataset.fallback && img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
        else markLoaded();
      });
    });
  }

  function updateLoadMore() {
    const remaining = state.visible.length - state.shown;
    loadMoreBtn.hidden = remaining <= 0;
    loadMoreBtn.textContent = `Load more photos (${Math.max(remaining, 0)} left)`;
  }

  loadMoreBtn.addEventListener("click", () => {
    const from = state.shown;
    state.shown = Math.min(state.shown + PAGE_SIZE, state.visible.length);
    appendCards(from, state.shown);
    updateLoadMore();
  });

  gallery.addEventListener("click", (e) => {
    const favBtn = e.target.closest(".fav-btn");
    if (favBtn) {
      const p = state.visible[Number(favBtn.dataset.index)];
      const added = toggleFav(p);
      if (state.favOnly && !added) setTimeout(render, 250);
      return;
    }
    const card = e.target.closest(".card-btn");
    if (card) openLightbox(Number(card.dataset.index));
  });

  /* =========================================================
     Lightbox
     ========================================================= */
  function openLightbox(index) {
    state.lastFocus = document.activeElement;
    buildThumbs();
    lightbox.hidden = false;
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => lightbox.classList.add("open"));
    show(index);
    lbClose.focus();
  }

  function closeLightbox() {
    stopSlideshow();
    if (document.fullscreenElement) document.exitFullscreen?.();
    lightbox.classList.remove("open");
    lbWrap.classList.remove("zoomed");
    document.body.classList.remove("no-scroll");
    setTimeout(() => {
      lightbox.hidden = true;
      if (state.favOnly) render(); // reflect favourites removed in the viewer
    }, 300);
    state.lastFocus?.focus?.();
  }

  function show(index) {
    const total = state.visible.length;
    if (!total) return;
    state.index = (index + total) % total; // wrap around
    const p = state.visible[state.index];

    lbImage.classList.remove("show");
    lbWrap.classList.remove("ready", "zoomed");

    const src = imgUrl(p, 1600);
    const loader = new Image();
    const reveal = (url) => {
      if (state.visible[state.index] !== p) return; // user moved on
      lbImage.src = url;
      lbImage.alt = `${p.title} — ${p.desc}`;
      lbWrap.classList.add("ready");
      requestAnimationFrame(() => lbImage.classList.add("show"));
    };
    loader.onload  = () => reveal(src);
    loader.onerror = () => reveal(fallbackUrl(p));
    loader.src = src;

    lbTitle.textContent = p.title;
    lbDesc.textContent = p.desc;
    lbTag.textContent = p.category;
    lightbox.style.setProperty("--c", colorOf(p.category));
    lbCounter.textContent = `${state.index + 1} / ${total}`;
    lbSource.href = sourceOf(p);
    setLbFav(state.favs.has(keyOf(p)));

    lbPrev.hidden = lbNext.hidden = total < 2;

    $$("button", lbThumbs).forEach((b, i) => {
      b.classList.toggle("active", i === state.index);
      b.setAttribute("aria-current", i === state.index ? "true" : "false");
    });
    lbThumbs.children[state.index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

    preload(state.index + 1);
    preload(state.index - 1);
    if (state.playing) restartProgress();
  }

  function setLbFav(on) {
    lbFav.classList.toggle("on", on);
    lbFav.setAttribute("aria-label", on ? "Remove from favourites" : "Add to favourites");
  }

  function preload(i) {
    const total = state.visible.length;
    const p = state.visible[(i + total) % total];
    if (p) new Image().src = imgUrl(p, 1600);
  }

  function buildThumbs() {
    lbThumbs.innerHTML = state.visible.map((p, i) =>
      `<button data-index="${i}" aria-label="Show ${escapeHtml(p.title)}">
         <img class="fx-target" src="${imgUrl(p, 160, 110)}" alt="" loading="lazy" />
       </button>`
    ).join("");
  }

  const next = () => show(state.index + 1);
  const prev = () => show(state.index - 1);
  const step = (fn) => { fn(); if (state.playing) restartTimer(); };

  lbNext.addEventListener("click", () => step(next));
  lbPrev.addEventListener("click", () => step(prev));
  lbFav.addEventListener("click", () => toggleFav(state.visible[state.index]));

  lbThumbs.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) step(() => show(Number(btn.dataset.index)));
  });

  lightbox.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeLightbox();
  });

  // Double-click (or double-tap) to zoom into the photo
  lbImage.addEventListener("dblclick", (e) => {
    const r = lbImage.getBoundingClientRect();
    lbImage.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    lbWrap.classList.toggle("zoomed");
  });

  /* ---------- Slideshow ---------- */
  function startSlideshow() {
    state.playing = true;
    lightbox.classList.add("playing");
    lbPlay.classList.add("playing");
    lbPlay.setAttribute("aria-label", "Pause slideshow");
    restartTimer();
  }

  function stopSlideshow() {
    state.playing = false;
    clearInterval(state.timer);
    lightbox.classList.remove("playing");
    lbPlay.classList.remove("playing");
    lbPlay.setAttribute("aria-label", "Start slideshow");
    lbProgress.classList.remove("run");
  }

  function restartTimer() {
    clearInterval(state.timer);
    restartProgress();
    state.timer = setInterval(next, SLIDE_DELAY);
  }

  function restartProgress() {
    lbProgress.classList.remove("run");
    void lbProgress.offsetWidth; // restart CSS animation
    lbProgress.style.animationDuration = `${SLIDE_DELAY}ms`;
    lbProgress.classList.add("run");
  }

  lbPlay.addEventListener("click", () => (state.playing ? stopSlideshow() : startSlideshow()));

  /* ---------- Fullscreen ---------- */
  function toggleFullscreen() {
    if (!document.fullscreenElement) lightbox.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }
  lbFull.addEventListener("click", toggleFullscreen);

  /* ---------- Keyboard ---------- */
  document.addEventListener("keydown", (e) => {
    // "/" jumps to search when the viewer is closed
    if (lightbox.hidden) {
      if (e.key === "/" && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
      return;
    }
    switch (e.key) {
      case "ArrowRight": step(next); break;
      case "ArrowLeft":  step(prev); break;
      case "Home":       step(() => show(0)); break;
      case "End":        step(() => show(state.visible.length - 1)); break;
      case "Escape":     closeLightbox(); break;
      case " ":          e.preventDefault(); state.playing ? stopSlideshow() : startSlideshow(); break;
      case "f": case "F": toggleFullscreen(); break;
      case "l": case "L": toggleFav(state.visible[state.index]); break;
      case "Tab":        trapFocus(e); break;
    }
  });

  // Keep keyboard focus inside the open lightbox
  function trapFocus(e) {
    const focusables = $$("button:not([hidden]), a[href]", lightbox).filter((el) => el.offsetParent !== null);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- Touch swipe ---------- */
  let touchX = null;
  lbImage.addEventListener("touchstart", (e) => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  lbImage.addEventListener("touchend", (e) => {
    if (touchX === null || lbWrap.classList.contains("zoomed")) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 45) step(dx < 0 ? next : prev);
    touchX = null;
  });

  /* =========================================================
     Scroll effects: sticky toolbar shadow + back-to-top
     ========================================================= */
  const onScroll = () => {
    const y = window.scrollY;
    toolbarWrap.classList.toggle("stuck", toolbarWrap.getBoundingClientRect().top <= parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) + 1 && y > 50);
    toTop.classList.toggle("show", y > 700);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* =========================================================
     Init
     ========================================================= */
  buildChips();
  updateFavCount(false);
  render();
  onScroll();
})();

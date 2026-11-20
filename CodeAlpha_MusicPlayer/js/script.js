/* =========================================================
   Zingify — Music Player logic
   CodeAlpha Frontend Internship · Task 4

   Required: play / pause / next / previous, song title,
   artist and duration, progress bar, volume control.
   Bonus: playlist + autoplay, shuffle, repeat (all / one),
   search, favourites, recently played, waveform seek bar,
   playback speed, sleep timer, add or drag-and-drop your own
   songs, keyboard shortcuts, light / dark theme, mini player
   on mobile, saved settings and lock-screen controls.
   ========================================================= */

(() => {
  "use strict";

  /* ---------- Elements ---------- */
  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const root = document.documentElement;
  const body = document.body;
  const el = {
    title: $("title"), artist: $("artist"), album: $("album"), status: $("statusLabel"),
    source: $("sourceLink"), fav: $("favBtn"), download: $("downloadBtn"), remove: $("removeBtn"),
    restoreBar: $("plRestore"), restoreText: $("plRestoreText"), restoreBtn: $("restoreBtn"), upNext: $("upNextTitle"),
    wave: $("wave"), barsBase: $("barsBase"), barsFill: $("barsFill"), tip: $("waveTip"),
    current: $("currentTime"), duration: $("duration"),
    play: $("playBtn"), prev: $("prevBtn"), next: $("nextBtn"), shuffle: $("shuffleBtn"), repeat: $("repeatBtn"),
    mute: $("muteBtn"), volume: $("volume"), volValue: $("volValue"), autoplay: $("autoplay"),
    speed: $("speedBtn"), speedValue: $("speedValue"),
    sleepBtn: $("sleepBtn"), sleepMenu: $("sleepMenu"), sleepValue: $("sleepValue"),
    list: $("plList"), count: $("plCount"), empty: $("plEmpty"), search: $("search"),
    tabs: document.querySelectorAll(".tab"), tabInk: $("tabInk"),
    file: $("fileInput"), theme: $("themeBtn"), help: $("helpBtn"), modal: $("helpModal"),
    drop: $("drop"), toast: $("toast"), stage: $("stage"),
    mini: $("mini"), miniBar: $("miniBar"), miniTitle: $("miniTitle"), miniArtist: $("miniArtist"),
    miniPlay: $("miniPlay"), miniPrev: $("miniPrev"), miniNext: $("miniNext"), miniInfo: $("miniInfo")
  };

  /* ---------- Saved settings ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("zingify." + key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("zingify." + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    }
  };

  /* ---------- State ---------- */
  const keyOf = (t) => (t.local ? "local:" + t.title : t.src);
  // songs the user removed from the playlist (remembered between visits)
  const removed = new Set(store.get("removed", []));
  const tracks = SONGS.filter((s) => !removed.has(s.src)).map((s) => ({ ...s, local: false, dur: null }));

  const state = {
    index: 0,
    playing: false,
    wantPlay: false,
    shuffle: store.get("shuffle", false),
    repeat: store.get("repeat", "off"),          // off | all | one
    autoplay: store.get("autoplay", true),
    volume: store.get("volume", 0.8),
    speed: store.get("speed", 1),
    muted: false,
    tab: "all",
    favs: new Set(store.get("favs", [])),
    recent: store.get("recent", []),              // track keys, newest first
    history: [],
    sleepTimer: null,
    sleepEnd: 0,
    sleepAtEnd: false,
    dragging: false
  };
  const savedIdx = tracks.findIndex((t) => keyOf(t) === store.get("lastKey", null));
  state.index = savedIdx >= 0 ? savedIdx : 0;

  const SPEEDS = [0.75, 1, 1.25, 1.5];

  /* ---------- Helpers ---------- */
  const fmt = (sec) => {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const removeSVG = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  const downloadSVG = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  const heartSVG = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6C19.5 15.9 12 20.5 12 20.5z"/></svg>';

  let toastTimer;
  // toast(message) — or toast(message, "Undo", callback) to show a button
  function toast(msg, actionLabel, onAction) {
    el.toast.textContent = msg;
    el.toast.classList.toggle("has-action", !!actionLabel);
    if (actionLabel) {
      const b = document.createElement("button");
      b.className = "toast-action";
      b.textContent = actionLabel;
      b.addEventListener("click", () => { el.toast.classList.remove("show"); onAction(); }, { once: true });
      el.toast.appendChild(b);
    }
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), actionLabel ? 6000 : 2200);
  }

  function setFill(range) {
    const pct = ((range.value - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty("--fill", pct + "%");
  }

  /* Number generator seeded by the song name, so each song
     always gets the same waveform shape */
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  }

  /* ---------- Waveform seek bar ---------- */
  const barCount = () => (window.innerWidth < 480 ? 46 : window.innerWidth < 900 ? 64 : 84);

  function buildWave() {
    const t = tracks[state.index];
    const rand = seeded(t ? t.title + t.artist : "zingify");
    const n = barCount();
    let html = "";
    for (let i = 0; i < n; i++) {
      // quieter at the start and end, louder in the middle — like a real song
      const shape = 0.35 + 0.65 * Math.sin((i / (n - 1)) * Math.PI);
      const h = Math.max(12, Math.round((0.3 + rand() * 0.7) * shape * 100));
      html += `<i style="--h:${h}%"></i>`;
    }
    el.barsBase.innerHTML = html;
    el.barsFill.innerHTML = html;
  }

  function setProgress(pct) {
    el.barsFill.style.setProperty("--p", pct + "%");
    el.miniBar.style.width = pct + "%";
    el.wave.setAttribute("aria-valuenow", Math.round(pct));
    el.wave.setAttribute("aria-valuetext", `${fmt(audio.currentTime)} of ${fmt(audio.duration)}`);
  }

  function pctFromEvent(e) {
    const r = el.wave.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  }

  el.wave.addEventListener("pointermove", (e) => {
    const p = pctFromEvent(e);
    el.tip.style.left = p * 100 + "%";
    el.tip.textContent = fmt(p * (audio.duration || 0));
    if (state.dragging) { setProgress(p * 100); el.current.textContent = fmt(p * (audio.duration || 0)); }
  });
  el.wave.addEventListener("pointerdown", (e) => {
    if (!audio.duration) return;
    state.dragging = true;
    el.wave.classList.add("dragging");
    el.wave.setPointerCapture(e.pointerId);
    const p = pctFromEvent(e);
    setProgress(p * 100);
    el.tip.style.left = p * 100 + "%";
  });
  el.wave.addEventListener("pointerup", (e) => {
    if (!state.dragging) return;
    state.dragging = false;
    el.wave.classList.remove("dragging");
    if (audio.duration) audio.currentTime = pctFromEvent(e) * audio.duration;
  });
  el.wave.addEventListener("pointercancel", () => { state.dragging = false; el.wave.classList.remove("dragging"); });

  let resizeTimer, lastBars = barCount();
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (barCount() !== lastBars) { lastBars = barCount(); buildWave(); } }, 150);
  });

  /* ---------- Library list ---------- */
  function visibleIndexes() {
    let idx;
    if (state.tab === "fav") idx = tracks.map((_, i) => i).filter((i) => state.favs.has(keyOf(tracks[i])));
    else if (state.tab === "recent") idx = state.recent.map((k) => tracks.findIndex((t) => keyOf(t) === k)).filter((i) => i >= 0);
    else idx = tracks.map((_, i) => i);

    const q = el.search.value.trim().toLowerCase();
    if (q) idx = idx.filter((i) => `${tracks[i].title} ${tracks[i].artist} ${tracks[i].album}`.toLowerCase().includes(q));
    return idx;
  }

  function renderList() {
    const idx = visibleIndexes();
    const frag = document.createDocumentFragment();

    idx.forEach((i) => {
      const t = tracks[i];
      const fav = state.favs.has(keyOf(t));
      const li = document.createElement("li");
      li.className = "pl-item" + (t.missing ? " missing" : "");
      li.tabIndex = 0;
      li.dataset.index = i;
      li.style.setProperty("--h", t.hue);
      li.setAttribute("aria-label", `${t.title} by ${t.artist}`);
      if (t.missing) li.title = "File not found in the songs folder";
      li.innerHTML = `
        <span class="pl-art" aria-hidden="true"></span>
        <span class="pl-text"><p class="pl-title"></p><p class="pl-artist"></p></span>
        <span class="pl-dur">${t.missing ? "missing" : t.dur ? fmt(t.dur) : "--:--"}</span>
        <button class="pl-fav${fav ? " on" : ""}" aria-label="${fav ? "Remove from" : "Add to"} favourites" aria-pressed="${fav}">${heartSVG}</button>
        <button class="pl-dl" aria-label="Download ${t.title.replace(/"/g, "&quot;")}" title="Download"${t.missing ? " disabled" : ""}>${downloadSVG}</button>
        <button class="pl-rm" aria-label="Remove ${t.title.replace(/"/g, "&quot;")} from playlist" title="Remove">${removeSVG}</button>`;
      const titleEl = li.querySelector(".pl-title");
      titleEl.textContent = t.title;
      titleEl.insertAdjacentHTML("afterbegin", '<span class="pl-eq" aria-hidden="true"><i></i><i></i><i></i></span>');
      if (t.mine) titleEl.insertAdjacentHTML("beforeend", '<span class="badge">Mine</span>');
      if (t.local) titleEl.insertAdjacentHTML("beforeend", '<span class="badge">Added</span>');
      li.querySelector(".pl-artist").textContent = t.artist;
      frag.appendChild(li);
    });
    el.list.replaceChildren(frag);

    el.count.textContent = tracks.length;
    const searching = el.search.value.trim() !== "";
    el.empty.textContent = {
      all: searching ? "No songs match your search." : "No songs yet — use “Add songs” or drop files here.",
      fav: searching ? "No favourites match your search." : "Tap the heart on any song to save it here.",
      recent: searching ? "No recent songs match your search." : "Songs you play will show up here."
    }[state.tab];
    el.empty.hidden = idx.length !== 0;
    highlightActive();
  }

  function highlightActive() {
    el.list.querySelectorAll(".pl-item").forEach((li) => {
      const active = Number(li.dataset.index) === state.index;
      li.classList.toggle("active", active);
      li.classList.toggle("playing", active && state.playing);
      if (active) li.setAttribute("aria-current", "true"); else li.removeAttribute("aria-current");
    });
  }

  /* Scroll the library so the playing song is visible (only the list scrolls, not the page) */
  function scrollToActive(smooth = true) {
    const row = el.list.querySelector(".pl-item.active");
    if (!row) return;
    const lr = el.list.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (rr.top >= lr.top && rr.bottom <= lr.bottom) return;          // already visible
    el.list.scrollBy({ top: rr.top - lr.top - (lr.height - rr.height) / 2, behavior: smooth ? "smooth" : "auto" });
  }

  function updateRow(i) {
    const row = el.list.querySelector(`.pl-item[data-index="${i}"]`);
    if (!row) return;
    const t = tracks[i];
    row.classList.toggle("missing", !!t.missing);
    row.querySelector(".pl-dur").textContent = t.missing ? "missing" : t.dur ? fmt(t.dur) : "--:--";
  }

  /* Read each song's length in the background (and spot missing files) */
  function preloadDurations() {
    tracks.forEach((t, i) => {
      if (t.dur || t.missing || t.probing) return;
      t.probing = true;
      const probe = new Audio();
      probe.preload = "metadata";
      probe.addEventListener("loadedmetadata", () => { t.dur = probe.duration; updateRow(i); probe.removeAttribute("src"); }, { once: true });
      if (t.mine) probe.addEventListener("error", () => {
        t.missing = true; updateRow(i); renderUpNext();
        console.warn(`Zingify: "${t.src}" was not found. Check the songs folder and js/songs.js.`);
      }, { once: true });
      probe.src = t.src;
    });
  }

  /* Tabs */
  el.tabs.forEach((tab, n) => {
    tab.addEventListener("click", () => {
      state.tab = tab.dataset.tab;
      el.tabs.forEach((b) => { b.classList.toggle("active", b === tab); b.setAttribute("aria-selected", b === tab); });
      el.tabInk.style.transform = `translateX(${n * 100}%)`;
      renderList();
      scrollToActive(false);
    });
  });

  /* ---------- Favourites & recently played ---------- */
  function toggleFav(i = state.index) {
    const t = tracks[i];
    if (!t) return;
    const k = keyOf(t);
    if (state.favs.has(k)) { state.favs.delete(k); toast("Removed from favourites"); }
    else { state.favs.add(k); toast("Added to favourites ♥"); }
    store.set("favs", [...state.favs].filter((x) => !x.startsWith("local:")));
    renderFavBtn();
    renderList();
  }
  function renderFavBtn() {
    const t = tracks[state.index];
    const on = !!t && state.favs.has(keyOf(t));
    el.fav.setAttribute("aria-pressed", on);
    el.fav.setAttribute("aria-label", on ? "Remove from favourites" : "Add to favourites");
    el.fav.querySelector("span").textContent = on ? "Favourited" : "Favourite";
  }
  function addRecent(t) {
    const k = keyOf(t);
    state.recent = [k, ...state.recent.filter((x) => x !== k)].slice(0, 20);
    store.set("recent", state.recent.filter((x) => !x.startsWith("local:")));
    if (state.tab === "recent") renderList();
  }
  el.fav.addEventListener("click", () => toggleFav());

  /* ---------- Download songs ----------
     Saves the song as a file on the device. The file is fetched first so
     the browser saves it instead of opening it. If the browser blocks that
     (e.g. opening index.html directly, or a site that doesn't allow it),
     the song opens in a new tab, where it can be saved with
     right-click → "Save as" (or ⋮ → Download on mobile). */
  function fileNameFor(t) {
    const fromSrc = decodeURIComponent((t.src.split("?")[0].split("/").pop() || ""));
    const ext = (fromSrc.match(/\.(mp3|m4a|wav|ogg|aac|flac|opus)$/i) || [".mp3"])[0];
    const base = t.local ? t.title : `${t.title}${t.artist && !t.local ? " - " + t.artist : ""}`;
    return base.replace(/[\\/:*?"<>|]+/g, "").trim() + ext;
  }

  function saveLink(href, name) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadSong(i = state.index) {
    const t = tracks[i];
    if (!t) { toast("No song to download"); return; }
    if (t.missing) { toast(`"${t.title}" wasn't found in the songs folder`); return; }
    const name = fileNameFor(t);

    // songs added from this device are already in memory
    if (t.src.startsWith("blob:")) { saveLink(t.src, name); toast(`Saving "${t.title}"`); return; }

    toast(`Preparing "${t.title}"…`);
    el.download.classList.add("busy");
    try {
      const res = await fetch(t.src);
      if (!res.ok) throw new Error(res.status);
      const url = URL.createObjectURL(await res.blob());
      saveLink(url, name);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast(`Downloaded "${t.title}"`);
    } catch {
      window.open(t.src, "_blank", "noopener");
      toast("Opened in a new tab — use right-click → Save as to keep it");
    } finally {
      el.download.classList.remove("busy");
    }
  }
  el.download.addEventListener("click", () => downloadSong());

  /* ---------- Remove songs from the playlist ----------
     A browser can't delete files from your computer, so a removed
     song is hidden from the playlist and remembered. "Restore all"
     (under the library) brings removed songs back. */
  function saveRemoved() { store.set("removed", [...removed]); }

  function renderRestoreBar() {
    const n = SONGS.filter((s) => removed.has(s.src)).length;
    el.restoreBar.hidden = n === 0;
    el.restoreText.textContent = `${n} song${n === 1 ? "" : "s"} removed`;
  }

  function showEmpty() {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    state.index = 0;
    buildWave();
    setProgress(0);
    el.title.textContent = "No songs yet";
    el.title.title = "";
    el.artist.textContent = "Click “Add songs” or drop music files here";
    el.album.textContent = "";
    el.status.textContent = "Ready";
    el.current.textContent = el.duration.textContent = "0:00";
    el.upNext.textContent = "—";
    el.miniTitle.textContent = "No songs";
    el.miniArtist.textContent = "—";
    el.source.classList.add("hidden");
    document.title = "Zingify · Music Player";
    renderFavBtn();
  }

  function removeSong(i = state.index) {
    const t = tracks[i];
    if (!t) { toast("No song to remove"); return; }
    const wasCurrent = i === state.index;
    const wasPlaying = wasCurrent && state.playing;

    tracks.splice(i, 1);
    if (!t.local) { removed.add(t.src); saveRemoved(); }

    // keep the other remembered positions pointing at the right songs
    state.history = state.history.filter((h) => h !== i).map((h) => (h > i ? h - 1 : h));
    shuffleNext = null;
    if (i < state.index) state.index--;

    if (!tracks.length) showEmpty();
    else if (wasCurrent) loadTrack(state.index % tracks.length, { autoplay: wasPlaying });
    else renderUpNext();

    renderList();
    renderRestoreBar();

    let undone = false;
    toast(`Removed "${t.title}"`, "Undo", () => {
      undone = true;
      const empty = !tracks.length;
      tracks.splice(i, 0, t);
      if (!t.local) { removed.delete(t.src); saveRemoved(); }
      state.history = state.history.map((h) => (h >= i ? h + 1 : h));
      shuffleNext = null;
      if (empty) loadTrack(i);
      else if (i <= state.index) state.index++;
      renderUpNext();
      renderList();
      renderRestoreBar();
      toast(`"${t.title}" is back`);
    });
    // songs added from this device: free the memory once Undo is no longer possible
    if (t.local) setTimeout(() => { if (!undone) URL.revokeObjectURL(t.src); }, 7000);
  }

  function restoreAll() {
    const current = tracks[state.index];
    const known = new Map(tracks.map((t) => [keyOf(t), t]));
    removed.clear();
    saveRemoved();
    const rebuilt = [
      ...SONGS.map((s) => known.get(s.src) || { ...s, local: false, dur: null }),
      ...tracks.filter((t) => t.local)
    ];
    tracks.splice(0, tracks.length, ...rebuilt);
    state.history = [];
    shuffleNext = null;
    if (current) { state.index = tracks.indexOf(current); renderUpNext(); }
    else loadTrack(0);
    renderList();
    renderRestoreBar();
    preloadDurations();
    toast("All removed songs are back");
  }

  el.remove.addEventListener("click", () => removeSong());
  el.restoreBtn.addEventListener("click", restoreAll);

  /* ---------- Queue ---------- */
  let shuffleNext = null;   // next song picked in advance while shuffling, so "Up next" is accurate

  const playable = (i) => !tracks[i].missing;

  function pickRandom() {
    const options = tracks.map((_, i) => i).filter((i) => i !== state.index && playable(i));
    return options.length ? options[Math.floor(Math.random() * options.length)] : state.index;
  }
  // next / previous song in order, skipping files that are missing
  function stepIndex(dir) {
    let i = state.index;
    for (let n = 0; n < tracks.length; n++) {
      i = (i + dir + tracks.length) % tracks.length;
      if (playable(i)) return i;
    }
    return (state.index + dir + tracks.length) % tracks.length;
  }
  function nextIndex() {
    if (state.shuffle) {
      if (shuffleNext === null || shuffleNext === state.index || shuffleNext >= tracks.length || !playable(shuffleNext)) shuffleNext = pickRandom();
      return shuffleNext;
    }
    return stepIndex(1);
  }
  function renderUpNext() {
    if (tracks.length < 2) { el.upNext.textContent = "—"; return; }
    if (state.repeat === "one") { el.upNext.textContent = "This song again (repeat one)"; return; }
    if (!state.shuffle && state.repeat === "off" && stepIndex(1) <= state.index) {
      el.upNext.textContent = "End of playlist"; return;
    }
    const t = tracks[nextIndex()];
    el.upNext.textContent = `${t.title} · ${t.artist}`;
  }

  /* ---------- Loading & playback ---------- */
  function loadTrack(i, { autoplay = false } = {}) {
    if (!tracks.length) return;
    state.index = (i + tracks.length) % tracks.length;
    const t = tracks[state.index];
    shuffleNext = null;

    audio.src = t.src;
    audio.load();
    audio.playbackRate = state.speed;

    el.title.textContent = t.title;
    el.title.title = t.title;
    el.artist.textContent = t.artist;
    el.album.textContent = t.album || "";
    root.style.setProperty("--hue", t.hue);
    el.current.textContent = "0:00";
    el.duration.textContent = t.dur ? fmt(t.dur) : "0:00";
    el.status.textContent = `Track ${state.index + 1} of ${tracks.length}`;
    el.miniTitle.textContent = t.title;
    el.miniArtist.textContent = t.artist;

    if (t.source) { el.source.href = t.source; el.source.classList.remove("hidden"); }
    else el.source.classList.add("hidden");

    document.title = `${t.title} · Zingify`;
    if (!t.local) store.set("lastKey", keyOf(t));

    buildWave();
    setProgress(0);
    renderFavBtn();
    renderUpNext();
    highlightActive();
    scrollToActive();
    updateMediaSession();

    state.wantPlay = autoplay;
    if (autoplay) play();
  }

  async function play() {
    if (!tracks.length) { toast("Add some songs first"); return; }
    state.wantPlay = true;
    try { await audio.play(); }
    catch (err) { if (err.name !== "AbortError") toast("Couldn't start playback — try again"); }
  }
  function pause() { state.wantPlay = false; audio.pause(); }
  const togglePlay = () => (audio.paused ? play() : pause());

  function next(fromEnded = false) {
    if (!tracks.length) return;
    state.history.push(state.index);
    if (state.history.length > 50) state.history.shift();

    if (fromEnded && !state.shuffle && state.repeat === "off" && stepIndex(1) <= state.index) {
      loadTrack(0);
      el.status.textContent = "End of playlist";
      toast("That was the last song");
      return;
    }
    loadTrack(nextIndex(), { autoplay: fromEnded || state.playing || state.wantPlay });
  }

  function prev() {
    if (!tracks.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    const target = state.shuffle && state.history.length ? state.history.pop() : stepIndex(-1);
    loadTrack(target, { autoplay: state.playing || state.wantPlay });
  }

  /* ---------- Audio events ---------- */
  let failures = 0;

  audio.addEventListener("play", () => {
    state.playing = true;
    body.classList.add("is-playing");
    el.play.setAttribute("aria-label", "Pause");
    el.miniPlay.setAttribute("aria-label", "Pause");
    el.status.textContent = "Now playing";
    addRecent(tracks[state.index]);
    highlightActive();
  });
  audio.addEventListener("pause", () => {
    state.playing = false;
    body.classList.remove("is-playing");
    el.play.setAttribute("aria-label", "Play");
    el.miniPlay.setAttribute("aria-label", "Play");
    if (!audio.ended) el.status.textContent = "Paused";
    highlightActive();
  });
  audio.addEventListener("waiting", () => { el.status.textContent = "Loading…"; });
  audio.addEventListener("playing", () => { el.status.textContent = "Now playing"; failures = 0; });

  audio.addEventListener("loadedmetadata", () => {
    tracks[state.index].dur = audio.duration;
    el.duration.textContent = fmt(audio.duration);
    updateRow(state.index);
  });

  audio.addEventListener("timeupdate", () => {
    if (state.dragging || !audio.duration) return;
    setProgress((audio.currentTime / audio.duration) * 100);
    el.current.textContent = fmt(audio.currentTime);
  });

  audio.addEventListener("ended", () => {
    if (state.sleepAtEnd) { clearSleep(); el.status.textContent = "Stopped by sleep timer"; toast("Sleep timer: goodnight 🌙"); return; }
    if (state.repeat === "one") { audio.currentTime = 0; play(); return; }
    if (state.autoplay || state.repeat === "all") next(true);
    else { el.status.textContent = "Finished"; highlightActive(); }
  });

  // If a song can't load, skip it — but stop after a few failures in a row
  audio.addEventListener("error", () => {
    if (!audio.src) return;
    const t = tracks[state.index];
    if (t && t.mine) { t.missing = true; updateRow(state.index); toast(`"${t.title}" wasn't found in the songs folder`); }
    if (!state.wantPlay) { el.status.textContent = "Couldn't load this song"; return; }
    if (++failures >= 3) {
      state.wantPlay = false;
      el.status.textContent = "Offline";
      toast("Songs can't load — check your internet connection");
      return;
    }
    if (!(t && t.mine)) toast(`Couldn't load "${t.title}" — skipping`);
    setTimeout(() => loadTrack(state.index + 1, { autoplay: true }), 1200);
  });

  /* ---------- Volume ---------- */
  function setVolume(v, save = true) {
    v = Math.min(1, Math.max(0, Math.round(v * 100) / 100));
    audio.volume = v;
    el.volume.value = v;
    setFill(el.volume);
    el.volValue.textContent = Math.round(v * 100);
    if (v > 0 && state.muted) setMuted(false);
    el.mute.classList.toggle("muted-on", state.muted || v === 0);
    state.volume = v;
    if (save) store.set("volume", v);
  }
  function setMuted(m) {
    state.muted = m;
    audio.muted = m;
    el.mute.classList.toggle("muted-on", m || audio.volume === 0);
    el.mute.setAttribute("aria-label", m ? "Unmute" : "Mute");
  }
  el.volume.addEventListener("input", () => setVolume(Number(el.volume.value)));
  el.mute.addEventListener("click", () => setMuted(!state.muted));

  /* ---------- Playback speed ---------- */
  function setSpeed(s, announce = true) {
    state.speed = s;
    audio.playbackRate = s;
    el.speedValue.textContent = s + "×";
    el.speed.classList.toggle("on", s !== 1);
    store.set("speed", s);
    if (announce) toast(`Speed ${s}×`);
  }
  el.speed.addEventListener("click", () => setSpeed(SPEEDS[(SPEEDS.indexOf(state.speed) + 1) % SPEEDS.length]));
  audio.addEventListener("loadstart", () => { audio.playbackRate = state.speed; });

  /* ---------- Sleep timer ---------- */
  function clearSleep() {
    clearTimeout(state.sleepTimer);
    state.sleepTimer = null; state.sleepEnd = 0; state.sleepAtEnd = false;
    el.sleepValue.textContent = "Sleep";
    el.sleepBtn.classList.remove("on");
  }
  function renderSleepLabel() {
    if (state.sleepAtEnd) { el.sleepValue.textContent = "End of song"; return; }
    if (state.sleepEnd) el.sleepValue.textContent = fmt(Math.max(0, state.sleepEnd - Date.now()) / 1000);
  }
  function openSleepMenu(open) {
    el.sleepMenu.hidden = !open;
    el.sleepBtn.setAttribute("aria-expanded", open);
  }
  el.sleepBtn.addEventListener("click", (e) => { e.stopPropagation(); openSleepMenu(el.sleepMenu.hidden); });
  el.sleepMenu.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    clearSleep();
    const v = b.dataset.min;
    if (v === "end") {
      state.sleepAtEnd = true;
      el.sleepBtn.classList.add("on");
      renderSleepLabel();
      toast("Music will stop after this song");
    } else if (v !== "0") {
      const ms = Number(v) * 60000;
      state.sleepEnd = Date.now() + ms;
      state.sleepTimer = setTimeout(() => {
        pause(); clearSleep();
        el.status.textContent = "Stopped by sleep timer";
        toast("Sleep timer: goodnight 🌙");
      }, ms);
      el.sleepBtn.classList.add("on");
      renderSleepLabel();
      toast(`Music will stop in ${v === "60" ? "1 hour" : v + " minutes"}`);
    } else {
      toast("Sleep timer off");
    }
    openSleepMenu(false);
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".sleep")) openSleepMenu(false); });
  setInterval(renderSleepLabel, 1000);

  /* ---------- Modes ---------- */
  function renderModes() {
    el.shuffle.setAttribute("aria-pressed", state.shuffle);
    el.repeat.setAttribute("aria-pressed", state.repeat !== "off");
    el.repeat.classList.toggle("one", state.repeat === "one");
    el.repeat.setAttribute("aria-label", `Repeat: ${state.repeat}`);
    el.autoplay.checked = state.autoplay;
    renderUpNext();
  }
  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    shuffleNext = null;
    store.set("shuffle", state.shuffle);
    renderModes();
    toast(state.shuffle ? "Shuffle on" : "Shuffle off");
  }
  function cycleRepeat() {
    state.repeat = { off: "all", all: "one", one: "off" }[state.repeat];
    store.set("repeat", state.repeat);
    renderModes();
    toast({ off: "Repeat off", all: "Repeat all songs", one: "Repeat this song" }[state.repeat]);
  }
  el.shuffle.addEventListener("click", toggleShuffle);
  el.repeat.addEventListener("click", cycleRepeat);
  el.autoplay.addEventListener("change", () => {
    state.autoplay = el.autoplay.checked;
    store.set("autoplay", state.autoplay);
    toast(state.autoplay ? "Autoplay on" : "Autoplay off");
  });

  /* ---------- Transport buttons ---------- */
  el.play.addEventListener("click", togglePlay);
  el.next.addEventListener("click", () => next());
  el.prev.addEventListener("click", prev);
  el.miniPlay.addEventListener("click", togglePlay);
  el.miniNext.addEventListener("click", () => next());
  el.miniPrev.addEventListener("click", prev);
  el.miniInfo.addEventListener("click", () => el.stage.scrollIntoView({ behavior: "smooth", block: "start" }));

  /* ---------- Library interaction ---------- */
  function pick(li) {
    const i = Number(li.dataset.index);
    if (i === state.index && audio.src) togglePlay();
    else { state.history.push(state.index); loadTrack(i, { autoplay: true }); }
  }
  el.list.addEventListener("click", (e) => {
    const li = e.target.closest(".pl-item");
    if (!li) return;
    if (e.target.closest(".pl-fav")) { toggleFav(Number(li.dataset.index)); return; }
    if (e.target.closest(".pl-dl")) { downloadSong(Number(li.dataset.index)); return; }
    if (e.target.closest(".pl-rm")) { removeSong(Number(li.dataset.index)); return; }
    pick(li);
  });
  el.list.addEventListener("keydown", (e) => {
    if (e.target.classList.contains("pl-item") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pick(e.target); }
    if (e.target.classList.contains("pl-item") && e.key === "Delete") {
      e.preventDefault(); e.stopPropagation();
      const i = Number(e.target.dataset.index);
      const nextRow = e.target.nextElementSibling || e.target.previousElementSibling;
      const nextIdx = nextRow ? Number(nextRow.dataset.index) : null;
      removeSong(i);
      // keep keyboard focus in the list
      if (nextIdx !== null) el.list.querySelector(`.pl-item[data-index="${nextIdx > i ? nextIdx - 1 : nextIdx}"]`)?.focus();
    }
  });
  el.search.addEventListener("input", renderList);

  /* ---------- Add your own songs (button or drag & drop) ---------- */
  function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|aac|flac|opus)$/i.test(f.name));
    if (!files.length) { toast("Those aren't audio files"); return; }
    const first = tracks.length;
    files.forEach((f, k) => {
      tracks.push({
        title: f.name.replace(/\.[^.]+$/, "").replace(/_+/g, " ").trim(),
        artist: "From your device",
        album: "",
        src: URL.createObjectURL(f),
        source: "",
        hue: 170 + ((first + k) * 37) % 180,
        local: true,
        dur: null
      });
    });
    if (state.tab !== "all") el.tabs[0].click(); else renderList();
    preloadDurations();
    loadTrack(first, { autoplay: true });
    toast(`Added ${files.length} song${files.length > 1 ? "s" : ""}`);
  }
  el.file.addEventListener("change", () => { addFiles(el.file.files); el.file.value = ""; });

  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  window.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; el.drop.classList.add("show"); });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragleave", (e) => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; el.drop.classList.remove("show"); } });
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; el.drop.classList.remove("show");
    addFiles(e.dataTransfer.files);
  });

  /* ---------- Theme ---------- */
  function setTheme(t) {
    root.dataset.theme = t;
    document.querySelector('meta[name="theme-color"]').content = t === "light" ? "#f4eee3" : "#0b1d22";
    store.set("theme", t);
  }
  el.theme.addEventListener("click", () => setTheme(root.dataset.theme === "light" ? "dark" : "light"));

  /* ---------- Shortcuts dialog ---------- */
  let lastFocus = null;
  function openHelp() { lastFocus = document.activeElement; el.modal.hidden = false; el.modal.querySelector(".modal-card [data-close]").focus(); }
  function closeHelp() { el.modal.hidden = true; if (lastFocus) lastFocus.focus(); }
  el.help.addEventListener("click", openHelp);
  el.modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeHelp(); });

  /* ---------- Keyboard shortcuts ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!el.modal.hidden) closeHelp(); openSleepMenu(false); return; }
    if (e.target.matches("input[type=search], input[type=text]") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!el.modal.hidden) return;
    const onRange = e.target.matches("input[type=range]");
    const inList = !!e.target.closest(".pl-list");

    switch (e.key) {
      case " ":
        if (e.target.closest("button, label, .pl-item, a")) return;
        e.preventDefault(); togglePlay(); break;
      case "ArrowRight":
        if (onRange) return;
        e.preventDefault(); if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); break;
      case "ArrowLeft":
        if (onRange) return;
        e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5); break;
      case "ArrowUp":
        if (onRange || inList) return;
        e.preventDefault(); setVolume(audio.volume + 0.05); toast(`Volume ${Math.round(audio.volume * 100)}`); break;
      case "ArrowDown":
        if (onRange || inList) return;
        e.preventDefault(); setVolume(audio.volume - 0.05); toast(`Volume ${Math.round(audio.volume * 100)}`); break;
      case "n": case "N": next(); break;
      case "p": case "P": prev(); break;
      case "m": case "M": setMuted(!state.muted); toast(state.muted ? "Muted" : "Sound on"); break;
      case "l": case "L": toggleFav(); break;
      case "d": case "D": downloadSong(); break;
      case "Delete": removeSong(); break;
      case "s": case "S": toggleShuffle(); break;
      case "r": case "R": cycleRepeat(); break;
      case "t": case "T": el.theme.click(); break;
      case "/": e.preventDefault(); el.search.focus(); break;
      case "?": openHelp(); break;
    }
  });

  /* ---------- Mini player (small screens) ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0 && tracks.length > 0;
      el.mini.classList.toggle("show", show);
      body.classList.toggle("has-mini", show);
      el.mini.setAttribute("aria-hidden", String(!show));
      el.mini.querySelectorAll("button").forEach((b) => (b.tabIndex = show ? 0 : -1));
    }, { threshold: 0 });
    io.observe(document.querySelector(".transport"));
  }

  /* ---------- Lock-screen / headphone controls ---------- */
  function updateMediaSession() {
    if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
    const t = tracks[state.index];
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album || "Zingify" });
  }
  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler("play", play);
      ms.setActionHandler("pause", pause);
      ms.setActionHandler("previoustrack", prev);
      ms.setActionHandler("nexttrack", () => next());
    } catch { /* not supported */ }
  }

  /* ---------- Start ---------- */
  setTheme(store.get("theme", "dark"));
  setVolume(state.volume, false);
  setSpeed(SPEEDS.includes(state.speed) ? state.speed : 1, false);
  renderModes();
  renderList();
  renderRestoreBar();
  if (tracks.length) loadTrack(state.index);
  else showEmpty();
  preloadDurations();
})();

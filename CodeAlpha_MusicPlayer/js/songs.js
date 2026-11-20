/* =========================================================
   Zingify — song library
   ---------------------------------------------------------
   PART 1: YOUR OWN SONGS (from your computer)
   ---------------------------------------------------------
   EASY WAY (automatic):
   1. Copy your music files into the "songs" folder.
   2. Double-click update-playlist.bat (project folder).
   3. Refresh the browser. Done — no typing needed.
   The tool writes js/my-songs.js for you. Run it again
   whenever you add or remove songs.

   MANUAL WAY (optional): add one { ... } block per song to
   MY_SONGS below, e.g. to fix a title or add a source link.
   If a file is in both lists, your manual entry wins.

   Fields:
     title  – song name shown in the player
     artist – singer / band
     album  – movie or album name (can be "")
     file   – exact file name inside the songs folder
              (capital letters must match)
     source – a web link for the song, or "" to hide the
              "Song source" button
     hue    – disc colour: 180 teal · 220 blue · 260 violet
              · 300 purple · 340 pink
   ========================================================= */

const MY_SONGS = [
  // { title: "Tum Hi Ho", artist: "Arijit Singh", album: "Aashiqui 2", file: "tum-hi-ho.mp3", source: "", hue: 330 },
  // { title: "Perfect",   artist: "Ed Sheeran",   album: "Divide",     file: "perfect.mp3",   source: "", hue: 200 },
];

/* ---------------------------------------------------------
   PART 2: FREE ONLINE DEMO SONGS
   ---------------------------------------------------------
   Free example songs from the SoundHelix project. Each one
   keeps its direct MP3 link (src) and source page (source).
   Set SHOW_DEMO_SONGS to false to show only your own songs.
   They need an internet connection to play.
   --------------------------------------------------------- */

const SHOW_DEMO_SONGS = false;   // no sample songs — only your own

const SOURCE_PAGE = "https://www.soundhelix.com/audio-examples";
const BASE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-";

const DEMO_SONGS = Array.from({ length: 16 }, (_, i) => {
  const n = i + 1;
  return {
    title: `SoundHelix Song ${n}`,
    artist: "T. Schürger",
    album: "SoundHelix Examples",
    src: `${BASE}${n}.mp3`,
    source: SOURCE_PAGE,
    hue: 170 + ((n * 37) % 180)   // calm teal → blue → violet → pink range
  };
});

/* ---------- Final playlist (your songs first) ---------- */
const AUTO_LIST = Array.isArray(window.AUTO_SONGS) ? window.AUTO_SONGS : [];
const manualFiles = new Set(MY_SONGS.map((s) => s.file));
const ALL_MY_SONGS = [...MY_SONGS, ...AUTO_LIST.filter((s) => s && s.file && !manualFiles.has(s.file))];

const SONGS = [
  ...ALL_MY_SONGS.map((s, i) => ({
    title: s.title || s.file,
    artist: s.artist || "Unknown artist",
    album: s.album || "",
    src: "songs/" + encodeURIComponent(s.file),
    source: s.source || "",
    hue: s.hue ?? 170 + ((i * 37) % 180),
    mine: true
  })),
  ...(SHOW_DEMO_SONGS ? DEMO_SONGS : [])
];

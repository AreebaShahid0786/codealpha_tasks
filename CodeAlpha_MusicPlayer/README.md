# Zingify — Music Player

CodeAlpha Frontend Development Internship · **Task 4: Music Player using JavaScript**
By **Areeba Shahid Qureshi** · Student ID: CA/DF1/432632

A responsive music player built with plain HTML, CSS and JavaScript, styled as a vinyl turntable in a "Midnight Lagoon" theme (deep teal with coral, amber and mint accents; warm sand in light mode).

## Features

**Required**
- Play, pause, next and previous controls
- Song title, artist, album and duration display
- Waveform progress bar — click or drag to seek, with a time preview on hover
- Volume slider with mute button

**Bonus**
- Library with three tabs: All songs, Favourites and Recently played, plus live search
- Autoplay toggle and an "Up next" preview
- Shuffle and repeat (all / one)
- Favourite songs with the heart button (saved between visits)
- Download songs: the **Download** button under the song title, the download icon on each playlist row, or the `D` key (works best through Live Server)
- Remove songs: the **Remove** button under the song title, the bin icon on each playlist row, or the `Delete` key. Each removal can be undone from the pop-up, and **Restore all** under the library brings removed songs back. The browser only hides removed songs (it can't delete files from your computer); the files stay in the `songs` folder.
- Playback speed (0.75× – 1.5×) and a sleep timer (15 / 30 / 60 min or end of song)
- Add your own songs with the **Add songs** button or by dragging files onto the page
- Turntable animation: the record spins and the tonearm moves onto it while playing
- Background colours shift to match each song
- Mini player bar on phones when you scroll down to the library
- Keyboard shortcuts (press `?` in the app to see them all)
- Light / dark theme, lock-screen and headphone controls, remembers your settings
- Responsive layout for laptop, tablet and mobile

## Run it
Use the VS Code **Live Server** extension (right-click `index.html` → Open with Live Server). The player comes with no sample songs: add your own as described below.

## Add songs from your computer
**Automatic (Windows):**
1. Copy your music files (MP3, M4A, WAV, OGG…) into the `songs` folder. Any file name works.
2. Double-click **`update-playlist.bat`**. It scans the folder, reads each song's title, artist and album from the file, and writes `js/my-songs.js`.
3. Refresh the browser. Your songs appear first with a **My song** tag and play offline.

Run `update-playlist.bat` again whenever you add or remove songs.

**Manual (optional):** add entries to `MY_SONGS` in `js/songs.js` to fix a title or add a source link. A manual entry replaces the automatic one for the same file.

Set `SHOW_DEMO_SONGS = false` in `js/songs.js` to show only your songs. `.gitignore` keeps the music files in `songs/` off GitHub.

## Optional demo songs (turned off)
Set `SHOW_DEMO_SONGS = true` in `js/songs.js` to add the free SoundHelix demo tracks below.

### Sources
The built-in tracks are free example songs from the SoundHelix project. Every track's direct MP3 link and source page are listed in `js/songs.js`.
- Source page: https://www.soundhelix.com/audio-examples
- Files: https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3 … SoundHelix-Song-16.mp3

## Project structure
```
CodeAlpha_MusicPlayer/
├── index.html
├── css/style.css
├── songs/              ← put your own music files here
├── update-playlist.bat ← double-click to rebuild your playlist
├── tools/update-playlist.ps1
├── js/my-songs.js      ← created by update-playlist.bat
├── js/songs.js     ← your song list + demo songs with source links
├── js/script.js    ← player logic
└── README.md
```

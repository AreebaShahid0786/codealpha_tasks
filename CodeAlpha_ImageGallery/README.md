# Pixora — Image Gallery

**CodeAlpha Frontend Development Internship — Task 1**

A responsive, interactive image gallery built with plain **HTML, CSS and JavaScript** (no frameworks), featuring **100 photos across 10 categories**.

## ✅ Task requirements covered

| Requirement | Implementation |
|---|---|
| Gallery with HTML & CSS layout | CSS Grid with an editorial mix of tall / wide / regular tiles, plus a compact grid option |
| JavaScript navigation (next/prev, lightbox) | Full-screen lightbox with next/prev buttons, counter and thumbnail strip |
| Hover effects & smooth transitions | Image zoom, card lift, caption slide-up, heart reveal, fade-in loading, animated filtering |
| Responsive design | Desktop → tablet → 2-column phone layout; swipe support in the lightbox |
| **Bonus:** filters / categories | 10 category filters with counts, live search, sorting, and 9 photo effects |

## 🗂 Categories (10 photos each)
Landscapes · Mountains · Beaches · Wildlife · Birds · Flowers · Architecture · Cityscapes · Food · Night Sky

## 🎨 Photo effects
Original · Monochrome · Noir · Sepia · Vintage · Warm · Cool · Vivid · Faded · Dramatic

## ✨ Extra features
- ❤️ Favourites, saved in the browser, with a "Favourites only" view
- Sort: Featured, A–Z, Z–A, Shuffle
- "Load more" pagination (24 photos at a time) so the page never feels crowded
- Large / small tile toggle
- Lightbox: slideshow with progress bar, fullscreen, double-click zoom, and a link to each photo's source
- Keyboard: `←` `→` navigate · `Space` slideshow · `F` fullscreen · `L` favourite · `Esc` close · `/` search
- Light / dark theme (remembered), sticky toolbar, back-to-top button, toast messages
- Accessible: labelled controls, focus trap in the viewer, skip link, reduced-motion support

## 📁 Project structure
```
CodeAlpha_ImageGallery/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── data.js      ← the 100 photos, with a source URL for each
│   └── script.js    ← gallery, filters, favourites and lightbox logic
└── README.md
```

## ▶️ How to run
1. Open the folder in **VS Code**.
2. Right-click `index.html` → **Open with Live Server** (or just open it in a browser).
3. An internet connection is needed for the photos and fonts.

## 🖼 About the photos
All 100 photos are from [Unsplash](https://unsplash.com) and free to use under the Unsplash License.
Each entry in `js/data.js` has a `photo` ID (the image file) and a `source` link to the photo's Unsplash page.
The viewer also has a source button for the photo on screen.

To use your own photos, create an `images/` folder and edit `js/data.js`:
```js
{ title: "My Photo", category: "Nature", src: "images/my-photo.jpg",
  desc: "Short description.", source: "https://link-to-original" }
```

## 🚀 Deploy (GitHub Pages)
1. Push this folder to a repo named **`CodeAlpha_ImageGallery`**.
2. Repo **Settings → Pages → Source: main branch / root**.
3. Live at `https://<username>.github.io/CodeAlpha_ImageGallery/`.

---
Photos: Unsplash · Fonts: Fraunces & Inter (Google Fonts)

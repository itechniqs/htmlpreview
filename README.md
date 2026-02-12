# HTML Viewer

> Preview any GitHub or BitBucket HTML file directly in your browser — no cloning, no downloads.

**Live:** [itechniqs.github.io/htmlpreview](https://itechniqs.github.io/htmlpreview/)

## ✨ Features

- 🔗 **Instant preview** — paste any GitHub/BitBucket HTML URL
- 📱 **Responsive preview** — toggle Desktop / Tablet / Mobile viewport
- 🔄 **CORS proxy fallback** — multiple proxy chain for reliability
- 📋 **Copy shareable link** — one-click preview URL sharing
- 🕐 **Recent history** — last 5 URLs saved locally
- 🌙 **Dark glassmorphism UI** — modern, premium design
- 🛡️ **Sandboxed iframe** — safe execution of previewed HTML
- ⚡ **Zero backend** — runs entirely in the browser

## 🚀 Usage

### Option 1: Visit the site
Go to [itechniqs.github.io/htmlpreview](https://itechniqs.github.io/htmlpreview/) and paste a URL.

### Option 2: Prepend to URL
```
https://itechniqs.github.io/htmlpreview/?https://github.com/twbs/bootstrap/blob/gh-pages/2.3.2/index.html
```

### Option 3: Run locally
```bash
git clone https://github.com/itechniqs/htmlpreview.git
cd htmlpreview
python3 -m http.server 8080
# Open http://localhost:8080
```

## 🏗️ Deploy to GitHub Pages

1. Push this repo to `https://github.com/itechniqs/htmlpreview`
2. Go to **Settings → Pages**
3. Set source to `main` branch, root `/`
4. Site will be live at `https://itechniqs.github.io/htmlpreview/`

## 📁 Structure

```
htmlpreview/
├── index.html   # Main page
├── style.css    # Design system & styles
├── preview.js   # Preview engine
└── README.md    # This file
```

## 📄 License

MIT © [itechniqs](https://github.com/itechniqs)

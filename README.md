# 🔥 LinkedIn Doomscroll Inferno

> A Chrome extension that turns your LinkedIn doomscrolling into a rising cartoon inferno. The further you scroll, the higher the cartoon flames climb. Once you scroll past 10 posts, the flames consume your entire screen and force a reckoning: **Get off LinkedIn** or **Post something and contribute to society!**

---

## ✨ Features

- **Cartoon Animated Flames**: Multi-layered cartoon flame tongues with bold comic outlines, undulating CSS wave animations, base coal glows, and floating ember particles.
- **Dynamic Scroll Progression**:
  - **0 Posts**: Gentle simmering warning embers at the bottom of the screen.
  - **1–9 Posts**: Flames progressively expand up the screen with every post scrolled past.
  - **10+ Posts (Critical Mass)**: Screen shakes, cartoon flames engulf 100% of the viewport, and the **Doomscroll Intervention Modal** takes over!
- **Interactive Intervention Modal**:
  - ✍️ **"Contribute to Society"**: Automatically scrolls back to top, triggers LinkedIn's "Start a post" composer, and rewards you for creating instead of consuming.
  - 🚪 **"Get Off LinkedIn"**: Redirects to a calming zen relaxation screen (`exit.html`) with breathing exercises and offline activities.
  - 💧 **"Extinguish with Water"**: Douses the flames with a 5-minute cooldown grace period.
- **Cheeky Doom Meter HUD**: Floating bottom-right badge showing live post count, animated flame emojis (`🔥` $\rightarrow$ `😅` $\rightarrow$ `🥵` $\rightarrow$ `😈`), and a fiery progress bar.
- **Customizable Toolbar Popup**: Adjust the post threshold (3 to 30 posts), toggle flames, or test the full-screen inferno with one click.
- **Standalone Demo Page (`demo.html`)**: Interactive mock LinkedIn feed included so you can test the entire experience immediately in your browser.

---

## 🚀 Quick Start: Try the Demo Right Now

You can test the flames and post-counting behavior immediately without even loading the extension:

1. Open `demo.html` directly in your Chrome browser:
   ```bash
   open /Users/anisha/.gemini/antigravity/scratch/linkedin-flame-scroll/demo.html
   ```
2. Scroll down past the 10 humorous mock posts to watch the flames rise and trigger the full-screen inferno!

---

## 🛠️ How to Install in Google Chrome

1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
2. In the top-right corner, switch on **Developer mode**.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the project folder:
   ```text
   /Users/anisha/.gemini/antigravity/scratch/linkedin-flame-scroll
   ```
5. Navigate to [linkedin.com/feed](https://www.linkedin.com/feed/) or open `demo.html`.
6. Start scrolling and watch the heat rise!

---

## 📁 Repository Structure

```text
linkedin-flame-scroll/
├── manifest.json       # Chrome Extension Manifest V3 configuration
├── content.js          # Core content script: post detection, scroll tracking, modal logic
├── content.css         # Cartoon animated flames, ember particle physics, inferno modal
├── popup.html          # Toolbar extension settings & preview UI
├── popup.js            # Settings controller & live status bridge
├── popup.css           # Styling for popup interface
├── exit.html           # Anti-doomscroll zen garden screen
├── demo.html           # Mock LinkedIn feed for instant testing
├── icons/              # Extension icons (16px, 48px, 128px, and vector SVG)
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg
├── .gitignore
└── README.md
```

---

## 📦 Pushing to GitHub

The local Git repository is already initialized and your initial commit is created on `main`.

To push this repository to your GitHub account:

### Option A: Using the GitHub Web Interface
1. Go to [github.com/new](https://github.com/new) and create a new repository named `linkedin-flame-scroll` (do not initialize with README, license, or .gitignore).
2. Run these commands in your terminal:
   ```bash
   cd /Users/anisha/.gemini/antigravity/scratch/linkedin-flame-scroll
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/linkedin-flame-scroll.git
   git branch -M main
   git push -u origin main
   ```

### Option B: Using GitHub CLI (`gh`)
If you have the `gh` CLI installed:
```bash
cd /Users/anisha/.gemini/antigravity/scratch/linkedin-flame-scroll
gh repo create linkedin-flame-scroll --public --source=. --push
```

---

## 📜 License
MIT License. Built to help break the scroll and inspire creation!

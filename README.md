# Stillroom — Lo-Fi Study Timer

A responsive, monochrome study timer for Sahil Patra. Built with **HTML5, CSS3, and vanilla JavaScript only**. It runs locally in a modern browser and does not require a backend, package manager, build step, or frontend framework.

## Run it

1. Extract the `study-timer` folder.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, or Safari).
3. Press **Start** to begin a focus session. The music player starts only when you press its Play button.

For the best experience, serve the folder through any simple static web server or open the file directly. No installation is required.

## Included features

- Pomodoro timer with focus, short-break, and long-break modes.
- Start, pause, reset, and skip controls.
- Countdown based on timestamps, so it stays accurate when the tab is inactive or the page is refreshed.
- Automatic next-session flow and optional auto-start settings.
- Session completion tracking, daily goal progress, study streaks, and lifetime focus totals.
- Settings and statistics saved in `localStorage`.
- Built-in generated ambient sound presets using the Web Audio API. No copyrighted or third-party audio assets are bundled. Previous/next, play/pause, and volume controls work without adding files.
- Responsive mobile navigation, accessible labels, reduced-motion support, and a monochrome light/dark appearance toggle.

## Edit the content

Open `js/script.js` and edit the `APP_CONFIG` object at the top of the file. It contains:

- `personalName`, hero eyebrow, and hero subtitle.
- Default focus, short-break, and long-break durations.
- Daily focus goal.
- Motivational quote array.
- Music preset titles, descriptions, chord frequencies, and ambience levels.
- LocalStorage key names.

The timer defaults and the values currently stored in a visitor's browser are separate. To test the app from a clean slate, clear the site's local storage in browser developer tools.

## Music customization

The current tracks are synthesized ambient presets. Their names, descriptions, chord progressions, and texture levels are editable in `APP_CONFIG.musicTracks`. The `assets/audio/` folder is intentionally ready for optional audio files if you later decide to replace the built-in sound engine with local MP3/OGG tracks.

## Data and privacy

All settings, timer state, and study statistics are stored locally in the browser using `localStorage`. The app has no backend and does not send your study data anywhere. Clearing browser storage will clear saved progress on that browser/device.

## Project structure

```text
study-timer/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── assets/
│   ├── audio/
│   │   └── README.md
│   ├── images/
│   └── icons/
└── README.md
```

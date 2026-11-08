# Lamelia

Learn with a plan and play songs on your kalimba. PWA with sheet music, tablature and a falling-notes mode. Works offline. Whatever Kalimba you have, you can use it.

*Aprende y toca canciones con tu kalimba. PWA instalable que funciona sin conexión.*

Languages: Español · Português · Deutsch · Français · English

## Status

**Phase 1 (this version)**

- Playable kalimba: multi-touch, slide a finger across the keys, synthesised kalimba sound with low latency.
- 17 keys in C major (C4–E6) by default, laid out like the real instrument, with numbers, note names and octave dots.
- Colorblind-friendly mode (high-contrast colours plus a shape on every key) and a shapes-only mode.
- Settings → *Advanced options*: number of keys, tonic, scale, octave, A4 reference pitch and fully custom tuning (set the note of each key).
- Installable on Android and fully usable offline.
- No accounts, no tracking: settings stay on your device.

**Roadmap**

2. Real kalimba through the microphone: tuner and play-along (the tuner is for your physical instrument).
3. Songs: public-domain library, plus personal song packs imported on the device (they are never uploaded anywhere).
4. Play modes: sheet music with sound, sheet music with a moving cursor, and *Cascada* (falling notes).
5. Progressive lessons and generated exercises.

## Run it

No build step. Any static server works (the service worker needs `http://localhost` or HTTPS):

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Tests (Node 20+):

```bash
npm test
```
Phone: 
With Chrome, go in the website and download on the app settings or Chrome options.

## Project layout

| Path | What it does |
| --- | --- |
| `index.html`, `css/style.css` | Page and look (black, dark wood, brass) |
| `js/tunings.js` | Scales, key layout, numbers and note names (pure functions, tested) |
| `js/audio.js` | Kalimba sound with the Web Audio API |
| `js/kalimba.js` | The playable instrument and touch handling |
| `js/settings.js`, `js/state.js` | Settings sheet, validation and saving |
| `js/i18n.js` | Translations |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline mode and installation |
| `tools/make_icons.py` | Regenerates the PNG icons (needs Pillow) |

When you add files that must work offline, list them in `ASSETS` inside `sw.js` and bump `VERSION`.

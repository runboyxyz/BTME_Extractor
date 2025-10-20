# BTME Ultrasonic Decoder — Studio Edition ![Release](https://img.shields.io/github/v/release/runboyxyz/BTME_Extractor?color=brightgreen&label=Final%20Release)

**Version:** v1.0.0 – Final Studio Edition  
**Status:** ✅ Stable release  
**Credit:** © 2025 **Runboy (Discord)**  

---

## What this is
A lean, browser-based **heterodyne decoder** for ultrasonic-embedded audio (≈20–24 kHz).  
It mirrors the original Python workflow used during the discovery of the hidden message:
**band-pass** → **real cosine mix-down** → **post low-pass** → **normalize**.  
No installs, no dependencies — just open `index.html`.

---

## How it works (plain English)
1. **Band-pass** isolates the 20–24 kHz region with short, musical IIR (biquad) cascades.  
2. **Heterodyne mix-down** multiplies the ultrasonic band by a cosine at the carrier (e.g., 22,050 Hz), shifting content into the audible range.  
3. **Post-low-pass** (~5 kHz) removes high-frequency images; a very light **DC-block** tidies the baseline.  
4. **Normalize + gain** give a consistent output, with short fades to soften transients.  
5. Optional **resample** produces smaller files or matches your target SR.

All processing occurs locally in your browser via the **Web Audio API** — nothing is uploaded or sent anywhere.

---

## Recommended settings
- **Source:** Lossless **48 kHz** audio (WAV, FLAC, or ALAC `.m4a`) to preserve the ultrasonic range.  
  Compressed formats (AAC, MP3, etc.) discard the necessary high-frequency data.
- **Typical BTME bands:**
  - **Low:** 20,200 Hz  
  - **High:** 23,800 Hz  
  - **LO (carrier):** 22,050 Hz (center of band is a good starting point)  
  - **Post-LP:** 5,000–5,200 Hz  
  - If percussion leaks, tighten to ~20,300–23,600 Hz or drop Post-LP slightly (~4,800–5,000 Hz).

---

## Usage
1. Open `index.html` (or use GitHub Pages for a hosted version).  
2. Load your audio file. For longer tracks, select a short segment (`t₀` / `t₁`) for faster processing.  
3. Adjust the band edges or carrier if needed, then click **Decode**.  
4. Listen in the built-in player or click **Download** to save a mono WAV.  

---

## Responsible use
This project is for **educational and research** purposes.  
Use only audio you **own or are authorized to analyze**.  
Do **not** use this tool to violate copyright, privacy, terms of service, or applicable law.  

---

## Acknowledgments

This project was inspired by the collective work of several individuals in the BTME research community:

- **zeugmatic** — the first to uncover the hidden ultrasonic clue and leave breadcrumbs for others to follow.  
- **highpants** — collaborated throughout development, offering key technical and creative insights during the decoding process.  
- **Stermworm** — bore witness and helped redirect focus when analyses went off track.  
- **obsessionfeeder** — created a detailed explanation and parallel implementation of the decoding process ([GitHub repository](https://github.com/obsessionfeeder/audio-demodulator)), which remains an excellent reference.

Their curiosity, persistence, and occasional healthy chaos helped shape a deeper understanding of the *Beyond the Map’s Edge* technical clue — and made the journey far more fun.

---

## Files
- `index.html` — UI, explanations, web audio player + download  
- `styles.css` — Studio-dark theme, responsive layout  
- `dsp.js` — IIR band-pass / post-LP, heterodyne mixer, normalize, WAV writer  
- `app.js` — I/O, presets, logging, preview & export  

---

© 2025 Runboy (Discord)

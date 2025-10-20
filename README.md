# BTME Ultrasonic Decoder

**What this is:**  
A lean, browser-based **heterodyne decoder** for ultrasonic-embedded audio (≈20–24 kHz).  
It mirrors the proven Python workflow used while discovering the hidden message: **band-pass** → **real cosine mix-down** → **post low-pass** → **normalize**.  
No installs, just open `index.html`.

**Credit:** © 2025 **Runboy (Discord)**

---

## How it works (plain English)
1. **Band-pass** isolates the 20–24 kHz region with short, musical IIR (biquad) cascades.  
2. **Heterodyne mix-down** multiplies the ultrasonic band by a cosine at the carrier (e.g., 22,050 Hz), shifting content into the audible range.  
3. **Post-low-pass** (~5 kHz) removes high-frequency images; a very light **DC-block** tidies the baseline.  
4. **Normalize + gain** give a consistent output, with short fades to soften transients.  
5. Optional **resample** produces smaller files or matches your target SR.

---

## Recommended settings
- Source: **48 kHz** WAV (to retain the ultrasonic band).
- Typical BTME bands:
  - **Low:** 20,200 Hz
  - **High:** 23,800 Hz
  - **LO:** 22,050 Hz (center of band is a good starting point)
  - **Post-LP:** 5,000–5,200 Hz
  - If percussion leaks, tighten to ~20,300–23,600 Hz and/or drop Post-LP to ~4,800–5,000 Hz.


---

## Usage
1. Open `index.html` (or host with GitHub Pages).
2. Load your file. For large files, set a short segment (`t₀`/`t₁`) to keep it fast.
3. Adjust the band and LO if needed; click **Preview**.
4. Click **Process & Download** to save a mono WAV.

---

## Responsible use
This project is for **educational and research** purposes.  
Only process audio you **own or are authorized to use**.  
Do **not** use this tool to violate privacy, copyright, terms of service, or applicable law.

---

## Files
- `index.html` — UI, explanations, web audio player + download
- `styles.css` — studio-dark theme, responsive layout
- `dsp.js` — IIR band-pass / post-LP, heterodyne mixer, normalize, WAV
- `app.js` — I/O, presets, logging, preview & export

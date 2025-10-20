# BTME Extractor — Extract Highfreq Audible (Hilbert Demod)

**Public demo for educational/research use.**  
© 2025 Discord user **Runboy**

---

## What it does

This app decodes speech embedded in an **ultrasonic band** (≈20–24 kHz):

1. **Band-pass prefilter** (moderately long Blackman FIR) isolates ~20–24 kHz.
2. **Hilbert demodulation (true single-sideband):**  
   We form the **analytic signal** and rotate it by `e^{-j 2π f_c t}` to baseband.  
   This moves **one** clean sideband into the audible range **without** creating a mirrored copy, which reduces music/percussion bleed versus simple mixing.
3. **DC-block + post-low-pass** cleans residual images.
4. **Gain and fades**, optional **resample** (default 22.05 kHz).

> TL;DR — *Rotate, don’t flip.* Hilbert demod provides a single clean baseband.

---

## Recommended settings

- **Source:** Prefer **48 kHz WAV** (preserves ultrasonic content).  
- **Time ranges:**  
  - 1-minute: **38–42 s**  
  - 3-minute: **173–177 s**
- **Band-pass:** Low ≈ **20,200 Hz**, High ≈ **23,800 Hz**  
- **LO/shift:** ≈ **22,050 Hz** (band midpoint works)  
- **Post-LP:** ≈ **5,200 Hz**  
- **Gain:** start at **12 dB** (raise to taste)

If percussion bleeds through, tighten the band (e.g., **20,300–23,600 Hz**) and/or reduce post-LP to **4,800–5,000 Hz**.

---

## Usage

- **Load defaults**: “1-minute” or “3-minute.”
- **Preview** and **Process & Download** sit on the same row for speedy A/B.
- A live **log** prints each processing step and RMS hints.

---

## Legal & ethical

Use only with audio you **own or are authorized to process**.  
Do not use this tool to violate terms of service, copyright, or applicable law.

---

## Project structure

- `index.html` — UI and explanatory copy
- `styles.css` — layout and theme
- `dsp.js` — FIRs, analytic Hilbert, real demod, utilities
- `app.js` — wiring, presets, logging, WAV export

No build step required; open `index.html` or host with GitHub Pages.

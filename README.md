# Extract Highfreq Audible — Web Decoder (by Runboy)

A small, static web app that reproduces the Python decoding chain used to reveal a hidden voice in **Beyond the Map’s Edge — Arkade Music**.  
All processing happens locally in your browser (no uploads, no servers).

## Quick start
1. Open `index.html` directly, or host the folder with GitHub Pages.
2. Load your audio file.
3. Click **Load 1-minute defaults** (t=38–42 s) or **Load 3-minute defaults** (t=173–180 s).
4. Click **Preview** to listen, **Process & Download** to save the result.

## DSP pipeline (fixed)
- **Band-pass 20–23.9 kHz** (HP 20 kHz + LP 23.9 kHz)
- **Hilbert SSB (LSB)** heterodyne at **LO=22,050 Hz**
- **DC-block 30 Hz**
- **Zero-phase low-pass** (default 6 kHz for 1-min, 5 kHz for 3-min)
- Optional **Music suppression**: speech HP 180 Hz + adaptive speech lift
- **Gain** (default 12 dB), **fade-in/out**, optional **resample** (default 22,050 Hz)

## Controls
- **Start/End**: time window in seconds.
- **Band-pass LOW/HIGH (Hz)**: define the ultrasonic window (20–23.9 kHz works well).
- **Shift / LO (Hz)**: 22,050 Hz moves 22.05±f kHz → ~f Hz baseband.
- **Post-mix LP (Hz)**: 5–6 kHz keeps speech, rejects images.
- **Gain (dB)**: overall level.
- **Fade (ms)**: short fade-in/out to prevent clicks.
- **Music suppression**: reduces program bleed (HP 180 Hz + adaptive lift).

## Notes
- For heavy bleed, try narrowing band-pass slightly (e.g., **20.3–23.6 kHz**) and set LP to **4.8–5.2 kHz**.
- The 3-minute capture generally decodes cleaner than the 1-minute version.

## Hosting (GitHub Pages)
- Create a repo (e.g., `website`), upload these files.
- In repo → **Settings → Pages → Branch: `main` / `/root`**.
- Your site will be served at `https://<user>.github.io/website/`.

## License & credit
- © 2025 **Runboy**. See `LICENSE` for terms.

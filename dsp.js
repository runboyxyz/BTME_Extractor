// dsp.js — Studio Edition (heterodyne + IIR biquads + WAV export)
// This mirrors your Python chain: BP (20–24 kHz) → real cosine mix → Post-LP → normalize.

const DSP = (() => {
  // ---------- Utilities ----------
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const dB2lin = (db) => Math.pow(10, db/20);

  function rms(x){
    let a=0; for(let i=0;i<x.length;i++){ const v=x[i]; a+=v*v; }
    return Math.sqrt(a/Math.max(1,x.length));
  }

  // ---------- Biquad filters (RBJ cookbook) ----------
  function biquadLP(fc,Q,fs){
    const w0=2*Math.PI*fc/fs, c=Math.cos(w0), s=Math.sin(w0), alpha=s/(2*Q);
    const b0=(1-c)/2, b1=1-c, b2=(1-c)/2, a0=1+alpha, a1=-2*c, a2=1-alpha;
    return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0]; // [b0,b1,b2,a1,a2]
  }
  function biquadHP(fc,Q,fs){
    const w0=2*Math.PI*fc/fs, c=Math.cos(w0), s=Math.sin(w0), alpha=s/(2*Q);
    const b0=(1+c)/2, b1=-(1+c), b2=(1+c)/2, a0=1+alpha, a1=-2*c, a2=1-alpha;
    return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0];
  }

  function biquadProcess(x, c){
    const y = new Float32Array(x.length);
    let x1=0,x2=0,y1=0,y2=0;
    const b0=c[0], b1=c[1], b2=c[2], a1=c[3], a2=c[4];
    for(let n=0;n<x.length;n++){
      const xn=x[n];
      const yn=b0*xn + b1*x1 + b2*x2 - a1*y1 - a2*y2;
      y[n]=yn; x2=x1; x1=xn; y2=y1; y1=yn;
    }
    return y;
  }
  function cascade(x, coeffs){ let y=x; for(const c of coeffs){ y=biquadProcess(y,c); } return y; }

  // ---------- Core steps ----------
  function bandpassIIR(x, fs, bpLo, bpHi){
    const Q = 1/Math.SQRT2; // Butterworth-ish
    let y = cascade(x, [biquadHP(bpLo, Q, fs), biquadHP(bpLo, Q, fs)]);
    y = cascade(y, [biquadLP(bpHi, Q, fs), biquadLP(bpHi, Q, fs)]);
    return y;
  }

  function mixDownReal(x, fs, fc){
    const y = new Float32Array(x.length);
    const w = 2*Math.PI*fc/fs;
    for(let n=0, ph=0; n<x.length; n++, ph+=w){ y[n] = x[n] * Math.cos(ph); }
    return y;
  }

  function postLowpassIIR(x, fs, lpCut){
    const Q = 1/Math.SQRT2;
    return cascade(x, [biquadLP(lpCut, Q, fs), biquadLP(lpCut, Q, fs)]);
  }

  function normalize(x, target = 0.98){
    let pk = 0; for(let i=0;i<x.length;i++){ const a = Math.abs(x[i]); if(a>pk) pk = a; }
    if(pk <= 0) return x;
    const s = target / pk;
    for(let i=0;i<x.length;i++) x[i] *= s;
    return x;
  }

  function applyGainDB(x, db){
    const g = dB2lin(db|0);
    const y = new Float32Array(x.length);
    for(let i=0;i<x.length;i++) y[i] = clamp(x[i]*g, -1, 1);
    return y;
  }

  function fadeInMs(x, fs, ms){
    const N = Math.min(x.length, Math.max(0, Math.round((ms/1000)*fs)));
    for(let i=0;i<N;i++) x[i] *= (i/(N||1));
    return x;
  }
  function fadeOutMs(x, fs, ms){
    const N = Math.min(x.length, Math.max(0, Math.round((ms/1000)*fs)));
    for(let i=0;i<N;i++) x[x.length-1-i] *= (i/(N||1));
    return x;
  }

  // Optional: very light DC block (HP at 30 Hz)
  function dcBlock(x, fs){
    const y = cascade(x, [biquadHP(30, 0.707, fs)]);
    return y;
  }

  // ---------- Resample (linear) ----------
  function resampleLinear(x, fsIn, fsOut){
    if(!fsOut || fsOut===fsIn) return { data:x, sr:fsIn };
    const ratio = fsOut / fsIn;
    const N = Math.floor(x.length * ratio);
    const y = new Float32Array(N);
    for(let i=0;i<N;i++){
      const t = i/ratio;
      const i0 = Math.floor(t), i1 = Math.min(x.length-1, i0+1);
      const frac = t - i0;
      y[i] = x[i0]*(1-frac) + x[i1]*frac;
    }
    return { data:y, sr:fsOut };
  }

  // ---------- WAV ----------
  function writeWavMonoPCM16(x, sr){
    const len = x.length;
    const buffer = new ArrayBuffer(44 + len*2);
    const view = new DataView(buffer);
    const ws = (o,s)=>{ for(let i=0;i<s.length;i++) view.setUint8(o+i, s.charCodeAt(i)); };

    ws(0,'RIFF'); view.setUint32(4, 36 + len*2, true);
    ws(8,'WAVE'); ws(12,'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);  // PCM
    view.setUint16(22, 1, true);  // mono
    view.setUint32(24, sr, true);
    view.setUint32(28, sr*2, true); // byte rate
    view.setUint16(32, 2, true);    // block align
    view.setUint16(34, 16, true);   // bits
    ws(36,'data'); view.setUint32(40, len*2, true);

    let off = 44;
    for(let i=0;i<len;i++,off+=2){
      let s = Math.max(-1, Math.min(1, x[i]));
      view.setInt16(off, s < 0 ? s*0x8000 : s*0x7FFF, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  // ---------- Public API ----------
  return {
    rms,
    bandpassIIR,
    mixDownReal,
    postLowpassIIR,
    normalize,
    applyGainDB,
    fadeInMs,
    fadeOutMs,
    dcBlock,
    resampleLinear,
    writeWavMonoPCM16,
  };
})();

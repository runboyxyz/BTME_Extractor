// app.js — Studio Edition controller (keeps your heterodyne + IIR chain)

const $ = (id) => document.getElementById(id);
const logEl = $('log');
const statusEl = $('status');
const playerEl = $('player');

function setStatus(t, cls){
  statusEl.textContent = t;
  statusEl.className = 'status ' + (cls||'');
}
function logln(s){ logEl.textContent += (logEl.textContent ? '\n' : '') + s; logEl.scrollTop = logEl.scrollHeight; }

function decodeToBuffer(file){
  return new Promise((resolve,reject)=>{
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    file.arrayBuffer().then(arr=>{
      ac.decodeAudioData(arr, (buf)=>resolve(buf), (e)=>reject(e));
    }).catch(reject);
  });
}

function sliceToMono(buf, t0, t1){
  const sr = buf.sampleRate;
  const a0 = Math.max(0, Math.floor((t0||0)*sr));
  const a1 = (t1 && t1>0) ? Math.min(Math.floor(t1*sr), buf.length) : buf.length;
  const len = Math.max(0, a1-a0);
  if(len<=0) return { data:new Float32Array(0), sr };
  const ch0 = buf.getChannelData(0);
  let x = new Float32Array(len);
  if(buf.numberOfChannels>1){
    const ch1 = buf.getChannelData(1);
    for(let i=0;i<len;i++) x[i] = 0.5*(ch0[a0+i] + ch1[a0+i]);
  } else {
    x.set(ch0.subarray(a0,a1));
  }
  return { data:x, sr };
}

function safeDownload(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function run(preview){
  setStatus(preview?'Preview…':'Processing…');
  const f = $('file').files[0];
  if(!f){ setStatus('Pick a file','bad'); alert('Choose a file'); return; }

  decodeToBuffer(f).then((buf)=>{
    const t0 = parseFloat($('t0').value||'0'), t1 = parseFloat($('t1').value||'0');
    let {data:x, sr} = sliceToMono(buf, t0, t1);
    logln(`Decoded ${sr} Hz, frames=${x.length}`);

    if(x.length > sr*20){
      if(!confirm('Segment > 20 s — continue? (Long clips are slower in-browser)')){
        setStatus('Aborted by user','bad'); return;
      }
    }

    if($('enableDSP').value==='1'){
      // Parameters
      let bpLo = +($('bpLo').value||20000);
      let bpHi = +($('bpHi').value||23900);
      let fc   = +($('fc').value||22050);
      const lp = +($('lp').value||5000);
      const gain = +($('gain').value||6);
      const fade = +($('fade').value||10);
      const outSR = parseInt(($('outsr').value||sr),10);

      // Guards
      const ny = sr/2, guard = (sr<=44500)?800:500;
      if(bpHi > ny-guard) bpHi = ny-guard;
      if(bpHi <= bpLo+300) bpHi = bpLo+300;
      if(!(fc>1000 && fc<ny-1000)) fc = 0.5*(bpLo+bpHi);

      // Band-pass (IIR)
      const r0 = DSP.rms(x);
      x = DSP.bandpassIIR(x, sr, bpLo, bpHi);
      const r1 = DSP.rms(x);
      logln(`Band-pass ${bpLo}–${bpHi} Hz | RMS: raw=${r0.toFixed(6)} → BP=${r1.toFixed(6)}`);

      // Heterodyne down-mix (real)
      x = DSP.mixDownReal(x, sr, fc);
      const r2 = DSP.rms(x);
      logln(`Mixed down by ${fc} Hz | RMS=${r2.toFixed(6)}`);

      // Post-LP + DC-block (very light)
      x = DSP.dcBlock(x, sr);
      x = DSP.postLowpassIIR(x, sr, lp);
      const r3 = DSP.rms(x);
      logln(`Post-LP ${lp} Hz | RMS=${r3.toFixed(6)}`);

      // Gain + fades
      x = DSP.normalize(x);
      x = DSP.applyGainDB(x, gain);
      x = DSP.fadeInMs(x, sr, Math.max(6, fade));
      x = DSP.fadeOutMs(x, sr, Math.max(6, fade));
      logln(`Normalize + gain ${gain} dB · fade ${fade} ms`);

      // Optional resample
      const res = DSP.resampleLinear(x, sr, outSR||sr);
      x = res.data; sr = res.sr;
      if(outSR && outSR!==buf.sampleRate){ logln(`Resampled to ${sr} Hz`); }
    } else {
      logln('DSP disabled — trimmed audio only');
    }

    if(preview){
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC({ sampleRate: sr });
      const startPlayback = ()=>{
        const b=ac.createBuffer(1, x.length, sr); b.copyToChannel(x, 0);
        const s=ac.createBufferSource(); s.buffer=b; s.connect(ac.destination); s.start();
        setStatus('Preview playing','ok'); logln('Preview started');
      };
      if(ac.state==='suspended'){ ac.resume().then(startPlayback).catch(startPlayback); } else { startPlayback(); }
      // also put into <audio> for UI convenience
      const wav = DSP.writeWavMonoPCM16(x, sr);
      playerEl.src = URL.createObjectURL(wav);
    } else {
      const wav = DSP.writeWavMonoPCM16(x, sr);
      const base = (f.name && f.name.replace(/\.[^.]+$/,'')) || 'output';
      safeDownload(wav, base+'_decoded.wav'); setStatus('Saved','ok'); logln('WAV saved');
      playerEl.src = URL.createObjectURL(wav);
    }
  }).catch((e)=>{
    setStatus('Error','bad');
    const msg = (e && e.message) ? e.message : String(e);
    logln('ERROR: '+msg);
    alert('Error: '+msg);
  });
}

$('preview').addEventListener('click', ()=>run(true));
$('process').addEventListener('click', ()=>run(false));

// Presets
$('btn1m').addEventListener('click', ()=>{
  $('t0').value='38'; $('t1').value='42';
  $('bpLo').value='20200'; $('bpHi').value='23800';
  $('fc').value='22050'; $('lp').value='5000';
  $('gain').value='6'; $('fade').value='10'; $('outsr').value='';
  logln('Loaded 1-minute defaults (38–42 s).');
});
$('btn3m').addEventListener('click', ()=>{
  $('t0').value='173'; $('t1').value='177';
  $('bpLo').value='20200'; $('bpHi').value='23800';
  $('fc').value='22050'; $('lp').value='5000';
  $('gain').value='6'; $('fade').value='10'; $('outsr').value='';
  logln('Loaded 3-minute defaults (173–177 s).');
});

(function(){
  const $ = (id)=>document.getElementById(id);
  const logln = (t)=>{ const L=$('log'); L.textContent += '\n'+t; L.scrollTop=L.scrollHeight; };
  const setStatus = (msg, cls)=>{ const s=$('status'); s.textContent=msg; s.className=cls||''; };

  logln('Script loaded '+new Date().toISOString());

  // Presets
  function load1m(){
    $('t0').value=38; $('t1').value=42;
    $('hp').value=20200; $('preLP').value=23800; $('shift').value=22050;
    $('lp').value=5200; $('gain').value=12; $('fade').value=10; $('outsr').value=22050;
    $('enableDSP').value='1';
    logln('Loaded 1-minute defaults (38–42 s, BP 20.2–23.8 kHz, LP 5.2 kHz, gain 12 dB)'); setStatus('1m defaults','ok');
  }
  function load3m(){
    $('t0').value=173; $('t1').value=177;
    $('hp').value=20200; $('preLP').value=23800; $('shift').value=22050;
    $('lp').value=5200; $('gain').value=12; $('fade').value=10; $('outsr').value=22050;
    $('enableDSP').value='1';
    logln('Loaded 3-minute defaults (173–177 s, BP 20.2–23.8 kHz, LP 5.2 kHz, gain 12 dB)'); setStatus('3m defaults','ok');
  }

  // IO helpers
  function decodeToBuffer(file){
    return new Promise((resolve,reject)=>{
      file.arrayBuffer().then((arr)=>{
        const AC=window.AudioContext||window.webkitAudioContext; const ac=new AC();
        const go=()=>ac.decodeAudioData(arr,(buf)=>{ setTimeout(()=>{try{ac.close()}catch(_){ }},100); resolve(buf); },reject);
        if(ac.state==='suspended'){ ac.resume().then(go).catch(()=>go()); } else go();
      }).catch(reject);
    });
  }
  function sliceToMono(src,t0s,t1s){
    const sr=src.sampleRate, L=src.length;
    const s=Math.max(0,Math.floor((t0s||0)*sr));
    const e=(t1s && t1s>0)?Math.min(L,Math.floor(t1s*sr)):L;
    const N=Math.max(1,e-s), out=new Float32Array(N);
    const c0=src.getChannelData(0), c1=src.numberOfChannels>1?src.getChannelData(1):null;
    for(let i=0;i<N;i++){const idx=s+i; out[i]=c1?0.5*(c0[idx]+c1[idx]):c0[idx];}
    return {data:out, sr:sr};
  }
  function writeWavMonoPCM16(x,sr){
    const len=x.length, bytes=44+len*2, v=new DataView(new ArrayBuffer(bytes));
    const ws=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); };
    ws(0,'RIFF'); v.setUint32(4,36+len*2,true); ws(8,'WAVE'); ws(12,'fmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
    ws(36,'data'); v.setUint32(40,len*2,true);
    let off=44; for(let i=0;i<len;i++,off+=2){ let s=x[i]; if(s>1)s=1; else if(s<-1)s=-1; v.setInt16(off, s<0?s*0x8000:s*0x7FFF, true); }
    return new Blob([v.buffer],{type:'audio/wav'});
  }
  function safeDownload(blob, name){
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  // Main: HP -> LP (BP) -> Hilbert demod -> DC -> post-LP -> gain -> (opt) resample
  function run(preview){
    const DSP = window.DSP;
    if(!DSP){ setStatus('DSP not loaded','bad'); logln('ERROR: window.DSP is undefined'); alert('dsp.js failed to load'); return; }

    setStatus(preview?'Preview…':'Processing…');
    const f=$('file').files[0];
    if(!f){ setStatus('Pick a file','bad'); alert('Choose a file'); return; }

    decodeToBuffer(f).then((buf)=>{
      const t0=parseFloat($('t0').value||'0'), t1=parseFloat($('t1').value||'0');
      let {data:x, sr}=sliceToMono(buf,t0,t1);
      logln(`Decoded ${sr} Hz, frames=${x.length}`);

      if($('enableDSP').value==='1'){
        // UI
        let hpHz=+($('hp').value||20200);
        let preLPHz=+($('preLP').value||23800);
        let lo=+($('shift').value||22050);
        const lpHz=+($('lp').value||5200);
        const gain=+($('gain').value||12);
        const fade=+($('fade').value||10);
        const outSR=parseInt(($('outsr').value||sr),10);

        // Guards: Nyquist & min width
        const ny=sr/2, guard=(sr<=44500)?800:500;
        if(preLPHz > ny-guard) preLPHz = ny-guard;
        if(preLPHz <= hpHz+300) preLPHz = hpHz+300;

        // If LO is out of range, center it in the band (avoids silence)
        if(!(lo>1000 && lo<ny-1000)) lo = 0.5*(hpHz+preLPHz);

        // Moderately long, steep filters (work well in-browser)
        const r0 = DSP.rms(x);
        x = DSP.zeroPhaseFIR(x, DSP.firwinHighpass(1025, hpHz, sr));
        const r1 = DSP.rms(x);
        x = DSP.zeroPhaseFIR(x, DSP.firwinLowpass(1537, preLPHz, sr));
        const r2 = DSP.rms(x);
        logln(`Band-pass HP ${hpHz} → LP ${preLPHz} | RMS: raw=${r0.toFixed(6)} → HP=${r1.toFixed(6)} → BP=${r2.toFixed(6)}`);

        // ---- After: Hilbert Demodulation (Single-Sideband)
        // The analytic signal lets us rotate the spectrum instead of flipping it —
        // only one clean copy of the audio band is shifted down into the hearing range.
        // No mirror, no cancellation — the speech becomes clearer and more natural.
        const xh = DSP.analyticHilbert(x);
        x = DSP.hilbertDemodReal(x, xh, sr, lo);
        const r3 = DSP.rms(x);
        logln(`Hilbert demod @ ${lo} Hz → baseband | RMS=${r3.toFixed(6)}`);

        // DC + post-LP (longer LP suppresses percussion remnants)
        x = DSP.zeroPhaseFIR(x, DSP.firwinHighpass(257, 30, sr));      logln('DC-block 30 Hz');
        x = DSP.zeroPhaseFIR(x, DSP.firwinLowpass(2049, lpHz, sr));     logln(`Post-LP ${lpHz} Hz (2049 taps)`);

        // Gain + fades
        x = DSP.applyGainDB(x, gain);
        x = DSP.fadeInMs(x, sr, Math.max(6, fade));
        x = DSP.fadeOutMs(x, sr, Math.max(6, fade));
        logln(`Gain ${gain} dB · fade ${fade} ms`);

        // Optional resample
        if(outSR && outSR!==sr){ const r=DSP.resampleLinear(x, sr, outSR); x=r.data; sr=r.sr; logln(`Resampled to ${sr} Hz`); }
      } else {
        logln('DSP disabled — trimmed audio only');
      }

      if(preview){
        const AC=window.AudioContext||window.webkitAudioContext; 
        const ac=new AC({sampleRate:sr});
        const startPlayback = ()=>{
          const b=ac.createBuffer(1,x.length,sr); b.copyToChannel(x,0);
          const s=ac.createBufferSource(); s.buffer=b; s.connect(ac.destination); s.start();
          setStatus('Preview playing','ok'); logln('Preview started');
        };
        if(ac.state==='suspended'){ ac.resume().then(startPlayback).catch(startPlayback); } else { startPlayback(); }
      } else {
        const wav=writeWavMonoPCM16(x, sr);
        const base = (f.name && f.name.replace(/\.[^.]+$/,'')) || 'output';
        safeDownload(wav, base+'_decoded.wav'); setStatus('Saved','ok'); logln('WAV saved');
      }
    }).catch((e)=>{ setStatus('Error','bad'); logln('ERROR: '+(e&&e.message?e.message:String(e))); alert('Error: '+(e&&e.message?e.message:String(e))); });
  }

  // Wire buttons
  document.getElementById('btn1m')?.addEventListener('click', load1m);
  document.getElementById('btn3m')?.addEventListener('click', load3m);
  document.getElementById('preview')?.addEventListener('click', ()=>run(true));
  document.getElementById('process')?.addEventListener('click', ()=>run(false));

  // Default
  load1m();
})();

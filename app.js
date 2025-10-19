/* =========================================================
   UI wiring + pipeline
   ========================================================= */

(function(){
  const $ = (id)=>document.getElementById(id);
  const logln = (t)=>{ const L=$('log'); L.textContent += '\n'+t; L.scrollTop=L.scrollHeight; };
  const setStatus = (msg, cls)=>{ const s=$('status'); s.textContent=msg; s.className=cls||''; };

  logln('Script loaded '+new Date().toISOString());

  /* Presets requested */
  function load1m(){
    $('t0').value=38; $('t1').value=42;
    $('hp').value=20000; $('preLP').value=23900; $('shift').value=22050;
    $('lp').value=6000; $('gain').value=12; $('fade').value=10; $('outsr').value=22050;
    $('enableDSP').value='1'; $('musicKill').checked=true;
    logln('Loaded 1-minute defaults (38–42 s, LP 6 kHz, gain 12 dB)'); setStatus('1-minute defaults','ok');
  }
  function load3m(){
    $('t0').value=173; $('t1').value=180;
    $('hp').value=20000; $('preLP').value=23900; $('shift').value=22050;
    $('lp').value=5000; $('gain').value=12; $('fade').value=10; $('outsr').value=22050;
    $('enableDSP').value='1'; $('musicKill').checked=true;
    logln('Loaded 3-minute defaults (173–180 s, LP 5 kHz, gain 12 dB)'); setStatus('3-minute defaults','ok');
  }

  /* IO helpers */
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

  /* Main pipeline (Hilbert SSB only) */
  function run(preview){
    setStatus(preview?'Preview…':'Processing…');
    const f=$('file').files[0];
    if(!f){ setStatus('Pick a file','bad'); alert('Choose a file'); return; }

    decodeToBuffer(f).then((buf)=>{
      const t0=parseFloat($('t0').value||'0'), t1=parseFloat($('t1').value||'0');
      let {data:x, sr}=sliceToMono(buf,t0,t1);
      logln(`Decoded ${sr} Hz, frames=${x.length}`);

      if($('enableDSP').value==='1'){
        let hpHz=+($('hp').value||20000);
        let preLPHz=+($('preLP').value||23900);
        const lo=+($('shift').value||22050);
        const lpHz=+($('lp').value||6000);
        const gain=+($('gain').value||12);
        const fade=+($('fade').value||10);
        const outSR=parseInt(($('outsr').value||sr),10);
        const doKill = $('musicKill').checked;

        // Band-pass (HP + pre-LP)
        x = DSP.zeroPhaseFIR(x, DSP.firwinHighpass(769,hpHz,sr));   logln(`Band-pass step 1: HP ${hpHz} Hz`);
        x = DSP.zeroPhaseFIR(x, DSP.firwinLowpass(769,preLPHz,sr)); logln(`Band-pass step 2: LP ${preLPHz} Hz`);

        // Hilbert SSB (LSB)
        const xh = DSP.analyticHilbert(x);
        x = DSP.ssbMixLSB(x, xh, sr, lo);                           logln(`SSB mix @ ${lo} Hz`);

        // DC-block + post-LP (longer for cleaner image rejection)
        x = DSP.zeroPhaseFIR(x, DSP.firwinHighpass(257,30,sr));     logln('DC-block 30 Hz');
        x = DSP.zeroPhaseFIR(x, DSP.firwinLowpass(1281,lpHz,sr));   logln(`Post-LP ${lpHz} Hz`);

        // Music suppression (speech HP + adaptive lift)
        if(doKill){
          x = DSP.speechHighpass(x, sr);                            logln('Speech HP 180 Hz');
          x = DSP.adaptiveSpeechLift(x, sr);                        logln('Adaptive speech lift');
        }

        // Gain + fades
        x = DSP.applyGainDB(x, gain);
        x = DSP.fadeInMs(x, sr, fade);
        x = DSP.fadeOutMs(x, sr, Math.max(6, fade));
        logln(`Gain ${gain} dB · fade ${fade} ms`);

        // Resample (if changed)
        if(outSR && outSR!==sr){ const r=DSP.resampleLinear(x, sr, outSR); x=r.data; sr=r.sr; logln(`Resampled to ${sr} Hz`); }
      } else {
        logln('DSP disabled — trimmed audio only');
      }

      if(preview){
        const AC=window.AudioContext||window.webkitAudioContext; const ac=new AC({sampleRate:sr});
        const b=ac.createBuffer(1,x.length,sr); b.copyToChannel(x,0);
        const s=ac.createBufferSource(); s.buffer=b; s.connect(ac.destination); s.start();
        setStatus('Preview playing','ok'); logln('Preview started');
      } else {
        const wav=writeWavMonoPCM16(x, sr);
        const base = (f.name && f.name.replace(/\.[^.]+$/,'')) || 'output';
        safeDownload(wav, base+'_decoded.wav'); setStatus('Saved','ok'); logln('WAV saved');
      }
    }).catch((e)=>{ setStatus('Error','bad'); logln('ERROR: '+(e&&e.message?e.message:String(e))); alert('Error: '+(e&&e.message?e.message:String(e))); });
  }

  /* Wire buttons */
  $('btn1m').addEventListener('click', load1m);
  $('btn3m').addEventListener('click', load3m);
  $('preview').addEventListener('click', ()=>run(true));
  $('process').addEventListener('click', ()=>run(false));

  // default to 1-minute preset on load
  load1m();
})();

/* =========================================================
   Minimal DSP primitives used by app.js
   - Blackman window FIR design (LP/HP)
   - edge-safe zero-phase FIR (reflection-padded filtfilt)
   - Hilbert analytic signal (FIR form) + SSB mixer (LSB)
   - Speech HP + simple adaptive speech lift
   - Gain, fades, linear resample
   - WAV writer helpers (in app.js)
   ========================================================= */

/* Windows & FIR builders */
function blackman(N){const w=new Float32Array(N),M=N-1;for(let n=0;n<N;n++)w[n]=0.42-0.5*Math.cos(2*Math.PI*n/M)+0.08*Math.cos(4*Math.PI*n/M);return w;}
function firwinLowpass(N,fc,sr){
  if(N%2===0)N++; const M=(N-1)>>1, f=fc/(sr/2), w=blackman(N), h=new Float32Array(N);
  for(let n=-M;n<=M;n++){const i=n+M; h[i]=(n===0)?2*f:Math.sin(2*Math.PI*f*n)/(Math.PI*n); h[i]*=w[i];}
  let s=0; for(let i=0;i<N;i++) s+=h[i]; for(let i=0;i<N;i++) h[i]/=s; return h;
}
function firwinHighpass(N,fc,sr){const lp=firwinLowpass(N,fc,sr),hp=new Float32Array(lp.length);for(let i=0;i<lp.length;i++)hp[i]=-lp[i];hp[(lp.length-1)>>1]+=1;return hp;}
function convolveTD(x,h){const N=x.length,M=h.length,y=new Float32Array(N+M-1);for(let n=0;n<N;n++){const xn=x[n];for(let k=0;k<M;k++)y[n+k]+=xn*h[k];}return y;}

/* Reflection-padded zero-phase FIR (filtfilt-like) */
function zeroPhaseFIR(x,h){
  const N=x.length,L=h.length,M=(L-1)>>1,R=Math.min(N-1,3*M);
  const xp=new Float32Array(R+N+R);
  for(let i=0;i<R;i++) xp[R-1-i]=x[i+1];
  xp.set(x,R);
  for(let j=0;j<R;j++) xp[R+N+j]=x[N-2-j];
  let y=convolveTD(xp,h); y=y.subarray(M,M+xp.length);
  const yr=new Float32Array(y.length); for(let k=0;k<y.length;k++) yr[k]=y[y.length-1-k];
  let z=convolveTD(yr,h); z=z.subarray(M,M+yr.length);
  const out=new Float32Array(N); for(let t=0;t<N;t++) out[t]=z[z.length-1-(R+t)];
  return out;
}

/* Hilbert & SSB (LSB) */
function hilbertTaps(N){if(N%2===0)N++;const M=(N-1)>>1,t=new Float32Array(N),w=blackman(N);
  for(let n=-M;n<=M;n++){const i=n+M; if(n===0){t[i]=0;continue;} const ideal=(n&1)?(2/(Math.PI*n)):0; t[i]=ideal*w[i];}
  return t;
}
function analyticHilbert(x){const h=hilbertTaps(801), xf=convolveTD(x,h), off=(h.length-1)>>1; return xf.subarray(off,off+x.length); }
function ssbMixLSB(x,xh,sr,lo){const y=new Float32Array(x.length),w=2*Math.PI*lo/sr; let p=0; for(let n=0;n<x.length;n++){const c=Math.cos(p),s=Math.sin(p); y[n]=x[n]*c + xh[n]*s; p+=w;} return y;}

/* Music suppression */
function speechHighpass(x,sr){const h=firwinHighpass(257,180,sr); return zeroPhaseFIR(x,h);}
function adaptiveSpeechLift(x,sr){
  const win=Math.max(8,Math.floor(0.010*sr)); // ~10 ms
  const env=new Float32Array(x.length); let sum=0;
  for(let i=0;i<x.length;i++){
    const v=x[i]; sum+=v*v; if(i>=win) sum-=x[i-win]*x[i-win];
    const rms=Math.sqrt(sum/Math.min(i+1,win)), target=0.125;
    let g=Math.pow((target/(rms+1e-6)),0.35); if(g>2.2)g=2.2; if(g<0.6)g=0.6; env[i]=g;
  }
  const out=new Float32Array(x.length); let a=0.15, gcur=1.0;
  for(let j=0;j<x.length;j++){ gcur=(1-a)*gcur + a*env[j]; out[j]=x[j]*gcur; }
  return out;
}

/* Gain, fades, resample */
function applyGainDB(x,dB){const g=Math.pow(10,dB/20), y=new Float32Array(x.length); for(let i=0;i<x.length;i++) y[i]=x[i]*g; for(let i=0;i<y.length;i++){ if(y[i]>1)y[i]=1-1e-6; if(y[i]<-1)y[i]=-1+1e-6; } return y; }
function fadeInMs(x,sr,ms){let n=Math.floor(ms*0.001*sr); if(n<=0) return x; n=Math.min(n,x.length); for(let i=0;i<n;i++) x[i]*= i/(n-1); return x; }
function fadeOutMs(x,sr,ms){let n=Math.floor(ms*0.001*sr); if(n<=0) return x; n=Math.min(n,x.length); for(let i=0;i<n;i++) x[x.length-1-i]*= i/(n-1); return x; }
function resampleLinear(x, srIn, srOut){
  if(srIn===srOut) return {data:x, sr:srIn};
  const ratio=srOut/srIn, N=Math.floor(x.length*ratio), y=new Float32Array(N); let t=0, step=srIn/srOut;
  for(let i=0;i<N;i++){const idx=t|0, frac=t-idx, a=x[idx], b=x[Math.min(idx+1,x.length-1)]; y[i]=a+frac*(b-a); t+=step;}
  return {data:y, sr:srOut};
}

/* export namespace (for app.js) */
window.DSP = {
  firwinLowpass, firwinHighpass, zeroPhaseFIR, analyticHilbert, ssbMixLSB,
  speechHighpass, adaptiveSpeechLift, applyGainDB, fadeInMs, fadeOutMs, resampleLinear
};

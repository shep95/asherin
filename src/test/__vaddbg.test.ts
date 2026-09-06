import { it } from "vitest";
import { featureSeries, FRAME } from "@/lib/sentinel/audio/dsp";
import { Vad, VAD_DEFAULTS, looksLikeSpeech } from "@/lib/sentinel/audio/vad";
const RATE=16000;
function voice(sec:number,f0:number,b=0.35){const n=Math.round(sec*RATE);const o=new Float32Array(n);for(let i=0;i<n;i++){const t=i/RATE;o[i]=(0.5*Math.sin(2*Math.PI*f0*t)+0.28*Math.sin(4*Math.PI*f0*t)+b*0.2*Math.sin(6*Math.PI*f0*t)+b*0.12*Math.sin(10*Math.PI*f0*t))*0.35*(0.85+0.15*Math.sin(2*Math.PI*4*t));}return o;}
function sil(sec:number,f=0.0004){const n=Math.round(sec*RATE);const o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=(Math.random()*2-1)*f;return o;}
function join(...p:Float32Array[]){const t=p.reduce((s,x)=>s+x.length,0);const o=new Float32Array(t);let a=0;for(const x of p){o.set(x,a);a+=x.length;}return o;}
it("dbg",()=>{
 const buf=join(sil(0.6),voice(1.1,130),sil(0.9),voice(1.0,210,0.9),sil(0.6));
 const ser=featureSeries(buf,RATE);
 const v=new Vad(VAD_DEFAULTS);
 let i=0;
 for(const f of ser){const r=v.push(f); if(i%10===0||r.segment) console.log(i, r.verdict, !!r.segment, f.rms.toFixed(4), v.noiseFloor.toFixed(5), f.zcr.toFixed(2), Math.round(f.centroid), (f.bands[1]+f.bands[2]).toFixed(2), looksLikeSpeech(f)); i++;}
});

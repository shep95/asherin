import { describe, it } from "vitest";
import { VisionEventEngine } from "@/lib/arvision/vision/eventEngine";
const W=1000,H=1000,T0=1_700_000_000_000;
const bag=(x:number,y:number)=>[{objectId:"obj1",label:"backpack",box:{x,y,width:60,height:60}}];
function pose(box:any){return{quality:.9,shoulderY:(box.y+box.height*.2)/H,hipY:(box.y+box.height*.55)/H,ankleY:(box.y+box.height*.98)/H,wrists:[],usable:true};}
function person(id:string,x:number,y:number){const box={x,y,width:80,height:200};return{trackId:id,box,speedPxPerSec:0,pose:pose(box)};}
function frame(atMs:number,tracks:any[],objects:any[]=[]){return{atMs,cameraId:"cam1",cameraLabel:"c",frameWidth:W,frameHeight:H,tracks,objects};}
describe("dbg",()=>{it("x",()=>{
const e=new VisionEventEngine({abandonDwellMs:3000});
let t=T0;
for(let i=0;i<10;i++) e.step(frame(t+i*400,[person("owner",100,400)],bag(120,560)));
t+=4000;
for(let i=0;i<20;i++){const o=e.step(frame(t+i*400,[],bag(120,560)));o.changed.forEach(c=>console.log("A",c.type,c.state));o.suppressed.forEach(s=>console.log("As",s.type,s.confidence));}
t+=8000;
for(let i=0;i<10;i++){const o=e.step(frame(t+i*400,[person("later",110,400)],bag(120,560)));o.changed.forEach(c=>console.log("B",c.type,c.state));o.suppressed.forEach(s=>console.log("Bs",s.type,s.confidence,s.reason.slice(0,60)));}
console.log(JSON.stringify(e.custody()));
});});

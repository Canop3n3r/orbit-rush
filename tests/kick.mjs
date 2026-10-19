import * as P from '../physics.js';
const cfgs=[{engines:3,s1fuel:25,s2fuel:6,payload:1},{engines:3,s1fuel:35,s2fuel:6,payload:0},{engines:5,s1fuel:35,s2fuel:9,payload:2},{engines:3,s1fuel:15,s2fuel:3,payload:2},{engines:5,s1fuel:25,s2fuel:6,payload:1}];
for (const cfg of cfgs) for (const res0 of [0,4]) {
 const v=P.buildRocket(cfg); v.throttle=1; let t=0,ph='a',res='?',mq=0,b=null,bres='-';
 while(t<1500){const r=Math.hypot(v.x,v.y),h=r-P.R,o=P.orbitOf(v);
  v.ang=P.assistAngle(v);
  if(ph==='a'){v.throttle=Math.max(0.2,Math.min(1,1-(v.q-22)/8)); if(h>5000&&o.ap>85000){v.throttle=0;ph='c'}}
  const vr=(v.x*v.vx+v.y*v.vy)/r; if(ph==='c'&&h>70000&&vr<40){v.throttle=1;ph='b'} if(ph==='b'&&o.pe>72000){v.throttle=0;ph='d';res='ORBIT t='+t.toFixed(0)+' s2 '+v.stages[1].fuel.toFixed(1)}
  if(v.cur===0&&v.stages[0].fuel<=res0&&h>1000){b=P.makeBooster(v);v.cur=1}
  mq=Math.max(mq,v.q); if(ph!=='d'&&P.stepVehicle(v,1/60)){res='crash';break} if(v.q>90){res='overQ h='+(h/1000).toFixed(1)+' vr='+vr.toFixed(0)+' ph='+ph+' cur='+v.cur+' t='+t.toFixed(0);break}
  if(b&&b.state==='flying'){P.boosterAutopilot(b);const e=P.stepVehicle(b,1/60);const sp=Math.hypot(b.vx,b.vy);const bvr=(b.x*b.vx+b.y*b.vy);if(bvr<0&&P.altOf(b)<25000&&sp>1400){b.state='x';bres='burn'}if(e){b.state='x';bres=sp<10?'LANDED':'crash'+sp.toFixed(0)}}
  if(ph==='d'&&(!b||b.state!=='flying'))break;
  t+=1/60;}
 console.log(JSON.stringify(Object.values(cfg)),'res',res0,res,'maxq',mq.toFixed(0),'booster',bres);
}

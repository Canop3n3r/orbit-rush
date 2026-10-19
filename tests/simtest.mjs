import * as P from '../physics.js';
function fly(cfg, label){
  const v=P.buildRocket(cfg); let b=null, t=0, dt=1/60, maxq=0, res='?', bres='none';
  v.throttle=1; let phase='ascent';
  while(t<1500){
    const h=P.altOf(v), r=Math.hypot(v.x,v.y), up=Math.atan2(v.y,v.x);
    const o=P.orbitOf(v);
    if(phase==='ascent'){ const pitch=Math.min(1.45,Math.sqrt(Math.max(h-300,0)/45000)*Math.PI/2);
      v.ang = up-pitch; v.throttle = v.q>22?0.6:1;
      if(h>5000&&o.ap>85000){v.throttle=0;phase='coast';} if(cfg.trace&&Math.round(t*60)%1200==0)console.log(t.toFixed(0),(h/1000).toFixed(1),Math.hypot(v.vx,v.vy).toFixed(0),v.q.toFixed(1),(o.ap/1000).toFixed(0),v.cur,v.stages[v.cur].fuel.toFixed(1)); }
    if(phase==='coast'){ v.ang=Math.atan2(v.vy,v.vx); const vr=(v.x*v.vx+v.y*v.vy)/r; if(h>P.ATM && vr<30) {v.throttle=1;phase='circ';} }
    if(phase==='circ'){ v.ang=Math.atan2(v.vy,v.vx); if(o.pe>75000){v.throttle=0;phase='done';} }
    if(v.cur===0 && v.stages[0].fuel<=(cfg.reserve||0)){ b=P.makeBooster(v); v.cur=1; }
    if(v.cur===1 && h>45000) v.fairing=0;
    maxq=Math.max(maxq,v.q);
    const e=P.stepVehicle(v,dt); if(e){res='crash t='+t.toFixed(0);break;}
    if(b&&b.state==='flying'){P.boosterAutopilot(b); const e2=P.stepVehicle(b,dt); const sp=Math.hypot(b.vx,b.vy);
      if(P.altOf(b)<25000&&sp>1400){b.state='burned';bres='burned up';}
      if(e2){b.state='done';bres=sp<10?'LANDED v='+sp.toFixed(1):'crashed v='+sp.toFixed(0)+' fuel '+b.stages[0].fuel.toFixed(2);}}
    if(phase==='done'&&(!b||b.state!=='flying')){res='ORBIT t='+t.toFixed(0)+' ap '+(o.ap/1000).toFixed(0)+' pe '+(o.pe/1000).toFixed(0)+' s2fuel '+v.stages[1].fuel.toFixed(2);break;}
    t+=dt;
  }
  console.log(label, JSON.stringify(P.rocketStats(cfg),(k,x)=>typeof x==='number'?+x.toFixed(2):x), res, 'booster:',bres,'maxQ',maxq.toFixed(1));
}
fly({engines:3,s1fuel:25,s2fuel:6,payload:1},'default');fly({engines:3,s1fuel:35,s2fuel:6,payload:1,reserve:4},'35+res4');fly({engines:3,s1fuel:35,s2fuel:9,payload:1,reserve:3},'35-9+res3');
fly({engines:3,s1fuel:25,s2fuel:6,payload:1,reserve:3},'default+reserve3');
fly({engines:5,s1fuel:35,s2fuel:9,payload:0,reserve:5},'big+reserve');
fly({engines:1,s1fuel:35,s2fuel:9,payload:2},'1 engine');
fly({engines:3,s1fuel:15,s2fuel:3,payload:2},'small/heavy');
fly({engines:5,s1fuel:35,s2fuel:9,payload:1,reserve:5},'5e35/9 pay1 res5');
fly({engines:5,s1fuel:35,s2fuel:6,payload:1,reserve:4},'5e35/6 pay1 res4');
fly({engines:3,s1fuel:35,s2fuel:6,payload:0,reserve:4},'3e35/6 cube res4');

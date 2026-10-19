import * as P from '../physics.js';
// Beginner: ignite, press F (auto-turn + Max-Q throttle cap), hold full throttle, stage when empty, never cut.
function run(cfg, mode){
  const v=P.buildRocket(cfg); let t=0, res='timeout', mq=0, minPitchOK=true;
  while(t<1500){
    const h=P.altOf(v), up=Math.atan2(v.y,v.x);
    if(mode==='upper' && v.cur===1) P.upperAutopilot(v); else { v.ang=P.assistAngle(v); v.throttle=P.autoThrottle(v); }
    const pitch=Math.atan2(Math.sin(up-v.ang),Math.cos(up-v.ang)); const o=P.orbitOf(v);
    if(o.pe<P.TARGET_PE && h>45000 && pitch>Math.PI/2+0.01) minPitchOK=false;
    if(v.cur===0&&v.stages[0].fuel<=0&&h>200) v.cur=1;
    mq=Math.max(mq,v.q);
    if(P.stepVehicle(v,1/60)){res='crash';break}
    if(v.q>80){res='overQ';break}
    if(o.pe>P.ATM&&h>P.ATM){res=`ORBIT t=${t.toFixed(0)} ap=${(o.ap/1e3).toFixed(0)} pe=${(o.pe/1e3).toFixed(0)} s2left=${v.stages[1].fuel.toFixed(1)}`;break}
    if(v.cur===1&&v.stages[1].fuel<=0&&o.pe<P.ATM){res='stranded ap='+(o.ap/1e3).toFixed(0);break}
    t+=1/60;
  }
  console.log(mode, JSON.stringify(Object.values(cfg)), res, 'maxQ', mq.toFixed(0), 'neverBelowHorizon', minPitchOK);
}
for (const c of [{engines:3,s1fuel:25,s2fuel:6,payload:1},{engines:3,s1fuel:25,s2fuel:6,payload:0},{engines:5,s1fuel:35,s2fuel:9,payload:2},{engines:3,s1fuel:35,s2fuel:6,payload:1}]) { run(c,'beginner'); run(c,'upper'); }

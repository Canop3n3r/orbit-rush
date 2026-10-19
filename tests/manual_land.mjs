import * as P from '../physics.js';
// Fly the default rocket, stage with ~4 t left, then land the booster with a "human-like" controller updated at 10 Hz.
const v=P.buildRocket({engines:3,s1fuel:25,s2fuel:6,payload:1}); let b=null, shipAng=null, t=0, ctl=0;
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
while(t<1500){
  if(!b){ v.ang=P.assistAngle(v); v.throttle=P.autoThrottle(v); if(v.stages[0].fuel<=4){b=P.makeBooster(v); v.cur=1; shipAng=P.predictImpact(b); b.ut=0;} P.stepVehicle(v,1/60); t+=1/60; continue; }
  const R=P.R, r=Math.hypot(b.x,b.y), h=r-R, up=Math.atan2(b.y,b.x), sp=Math.hypot(b.vx,b.vy), vr=(b.x*b.vx+b.y*b.vy)/r, vh=(b.x*b.vy-b.y*b.vx)/r, d=R*wrap(shipAng-up);
  if((ctl+=1/60)>=0.1){ ctl=0;
    const retro=Math.atan2(-b.vy,-b.vx), m=P.massOf(b), aMax=215*280/310/m, g=9.81;
    if(h>20000&&sp>1120&&vr<0){b.ang=retro;b.ut=1;}
    else { const ia=h>3000?P.predictImpact(b):null, miss=ia===null?d:R*wrap(shipAng-ia); const vhDes=h>3000?(Math.abs(miss)>150?-Math.sign(miss)*1e3:-vh):Math.max(-30,Math.min(30,-d*0.05)), err=h>3000?(Math.abs(miss)>150?-Math.sign(miss)*20:0):vhDes-(-vh), vdes=Math.sqrt(2*0.6*(aMax-g)*Math.max(h-3,0))+2, ta=Math.max(-0.35,Math.min(0.35,err*0.03));
      if(h<9000&&-vr>vdes){b.ang=up-ta;b.ut=Math.min(1,(g+(-vr-vdes)*1.5)/aMax/Math.cos(ta));}
      else if(h>2500&&Math.abs(err)>8){b.ang=up-Math.sign(err)*1.2;b.ut=0.25;} else {b.ang=h<300?up:retro;b.ut=0;}
      if(h<60)b.ang=up; }
  }
  b.throttle=b.stages[0].fuel>0?b.ut:0; b.n=h>12000?3:1;
  const e=P.stepVehicle(b,1/60); t+=1/60;
  if(Math.round(t*60)%600===0) console.log(t.toFixed(0),(h/1e3).toFixed(2),'vr',vr.toFixed(0),'vh',(-vh).toFixed(0),'d',d.toFixed(0),'fuel',b.stages[0].fuel.toFixed(2));
  if(e||h<P.R*0){const sp2=Math.hypot(b.vx,b.vy);console.log('TOUCHDOWN v',sp2.toFixed(1),'dist',Math.abs(d).toFixed(1),'fuel',b.stages[0].fuel.toFixed(2));break;}
}

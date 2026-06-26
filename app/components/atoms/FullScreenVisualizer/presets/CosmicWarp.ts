import type { PresetModule } from "./types";

// ═══════════════════════════════════════════════════════════════
// 穿梭宇宙 V16
// ═══════════════════════════════════════════════════════════════
//
// 望远镜飞行：行星从中心沿射线向外发散
//
// 核心模型：8 颗行星池，delay 倒计时激活，同一时间 2~3 颗可见。
// 每颗从屏幕正中出现（远处小光点），沿随机射线方向逐渐移动、
// 变大，最后消失在屏幕边缘。模拟望远镜向深空飞行时，
// 星星从视野中心出现并向四周发散的效果。
//
// - travel: 0→1 全程
// - 位置：从中心沿 angle 射线向外，ease-out 加速
// - delay 逐帧递减，>0 时跳过，=0 时开始飞行
//
// ═══════════════════════════════════════════════════════════════

interface Star{x:number;y:number;z:number;size:number;hue:number;twP:number;twS:number;flare:boolean}
interface DSO{sx:number;sy:number;size:number;hue:number;sat:number;light:number;alpha:number;rot:number;stretch:number;ps:number;pp:number}
interface Aurora{x:number;y:number;w:number;h2:number;hue:number;sat:number;light:number;alpha:number;wp:number;wf:number;wa:number;ds:number;stretch:number}
interface Nebula{x:number;y:number;size:number;hue:number;sat:number;light:number;opacity:number;sx:number;sy:number;rot:number;dr:number;wp:number}
type PT="rocky"|"gas"|"ice"|"volcanic"|"ocean"|"lava"|"desert"|"tundra"
interface Planet{
  travel:number;speed:number;delay:number;
  angle:number;
  spawnT:number;
  maxRadius:number;
  pp:number; // 缓存当前 pp 用于排序
  type:PT;hue:number;
  rot:number;rotS:number;tex:ImageData|null;
}

const STAR_COUNT=1200,DSO_COUNT=500,PLANET_COUNT=8,NEBULA_COUNT=16,AURORA_COUNT=12

const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const sst=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)}
const sstR=(e0:number,e1:number,x:number)=>1-sst(e0,e1,x)

// ════════════════════════════════════════════════════
// 纹理
// ════════════════════════════════════════════════════

function genTex(type:PT,seed:number):ImageData{
  const w=256,h=128;const c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d")!
  // seeded RNG per texture for endless variety
  let ss=seed;const sr=()=>{ss|=0;ss=Math.imul(ss^ss>>>16,0x21f0aaad)|0;ss=Math.imul(ss^ss>>>15,0x735a2d97)|0;return((ss^ss>>>15)>>>0)/4294967296}
  const ra2=(a:number,b:number)=>a+sr()*(b-a);const ri2=(a:number,b:number)=>Math.floor(ra2(a,b+1))
  const gd=(c1:number[],c2:number[])=>{const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,`rgb(${c1[0]},${c1[1]},${c1[2]})`);g.addColorStop(0.5,`rgb(${(c1[0]+c2[0])/2},${(c1[1]+c2[1])/2},${(c1[2]+c2[2])/2})`);g.addColorStop(1,`rgb(${c2[0]},${c2[1]},${c2[2]})`);ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}
  switch(type){
    case"rocky":{const s=ra2(0.85,1.15);gd([140*s,120*s,100*s],[110*s,90*s,70*s]);const n=ri2(18,48);for(let i=0;i<n;i++){const cx=ra2(0,w),cy=ra2(0,h),r=ra2(3,w*0.22);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=`rgba(${ri2(40,85)},${ri2(28,68)},${ri2(18,52)},${ra2(0.18,0.55)})`;ctx.fill();if(r>8){ctx.beginPath();ctx.arc(cx-r*0.12,cy-r*0.12,r*0.75,0,Math.PI*2);ctx.fillStyle=`rgba(${ri2(150,220)},${ri2(130,200)},${ri2(100,170)},${ra2(0.05,0.18)})`;ctx.fill()}}addN(ctx,w,h,ra2(0.05,0.2));break}
    case"gas":{const s=ra2(0.82,1.18);gd([210*s,190*s,160*s],[170*s,150*s,120*s]);const b=ri2(8,20);for(let i=0;i<b;i++){const by=(i/b)*h+ra2(-h/b/3,h/b/3),bh=(h/b)*ra2(0.35,1.4);ctx.fillStyle=`rgba(${ri2(130,250)},${ri2(90,230)},${ri2(70,210)},${ra2(0.2,0.55)})`;ctx.fillRect(0,by,w,bh)}break}
    case"ice":{const s=ra2(0.88,1.12);gd([190*s,220*s,250*s],[140*s,180*s,230*s]);const n=ri2(10,32);for(let i=0;i<n;i++){ctx.strokeStyle=`rgba(${ri2(90,180)},${ri2(160,230)},${ri2(220,255)},${ra2(0.1,0.4)})`;ctx.lineWidth=ra2(0.4,2.8);ctx.beginPath();let cx=ra2(0,w),cy=ra2(0,h);ctx.moveTo(cx,cy);for(let j=0;j<ri2(4,12);j++){cx+=ra2(-w*0.14,w*0.14);cy+=ra2(-h*0.1,h*0.1);ctx.lineTo(cx,cy)}ctx.stroke()}addN(ctx,w,h,ra2(0.04,0.14));break}
    case"volcanic":{const s=ra2(0.88,1.12);gd([90*s,40*s,30*s],[55*s,22*s,18*s]);for(let i=0;i<ri2(8,22);i++){ctx.strokeStyle=`rgba(${ri2(200,255)},${ri2(85,175)},${ri2(20,75)},${ra2(0.25,0.75)})`;ctx.lineWidth=ra2(0.8,4.5);ctx.beginPath();let cx=ra2(0,w),cy=ra2(0,h);ctx.moveTo(cx,cy);for(let j=0;j<ri2(5,14);j++){cx+=ra2(-w*0.2,w*0.2);cy+=ra2(-h*0.14,h*0.14);ctx.lineTo(cx,cy)}ctx.stroke()}for(let i=0;i<ri2(20,60);i++){const p2x=ra2(0,w),p2y=ra2(0,h),pr2=ra2(1,7);ctx.beginPath();ctx.arc(p2x,p2y,pr2,0,Math.PI*2);ctx.fillStyle=`rgba(${ri2(220,255)},${ri2(65,145)},${ri2(15,65)},${ra2(0.12,0.55)})`;ctx.fill()}addN(ctx,w,h,ra2(0.06,0.18));break}
    case"ocean":{gd([28,75,140],[18,48,98]);const n=ri2(6,22);for(let i=0;i<n;i++){const cy=ra2(0,h),cw=ra2(w*0.25,w*1.3),ch=ra2(h*0.015,h*0.09);ctx.fillStyle=`rgba(${ri2(90,210)},${ri2(140,240)},${ri2(190,255)},${ra2(0.12,0.45)})`;ctx.beginPath();ctx.ellipse(w/2,cy,cw/2,ch/2,0,0,Math.PI*2);ctx.fill()}for(let i=0;i<ri2(2,8);i++){const cy=ra2(0,h),cw=ra2(w*0.2,w*0.7),ch=ra2(h*0.02,h*0.12);ctx.fillStyle=`rgba(255,255,255,${ra2(0.03,0.2)})`;ctx.beginPath();ctx.ellipse(w/2,cy,cw/2,ch/2,0,0,Math.PI*2);ctx.fill()}addN(ctx,w,h,ra2(0.03,0.12));break}
    case"lava":{const s=ra2(0.9,1.1);gd([200*s,78*s,18*s],[150*s,48*s,12*s]);for(let i=0;i<ri2(8,28);i++){const cy=ra2(0,h),r=ra2(h*0.015,h*0.14);ctx.beginPath();ctx.arc(w/2+ra2(-w*0.12,w*0.12),cy,r,0,Math.PI*2);ctx.fillStyle=`rgba(${ri2(255,255)},${ri2(120,210)},${ri2(25,90)},${ra2(0.25,0.75)})`;ctx.fill();if(i%3===0){ctx.strokeStyle=`rgba(255,${ri2(140,230)},30,${ra2(0.08,0.35)})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(w/2+ra2(-w*0.12,w*0.12),cy,r*1.3,0,Math.PI*2);ctx.stroke()}}for(let i=0;i<ri2(4,14);i++){const cx=ra2(0,w),cy=ra2(0,h),r2=ra2(4,w*0.14);ctx.beginPath();ctx.arc(cx,cy,r2,0,Math.PI*2);ctx.fillStyle=`rgba(25,8,4,${ra2(0.12,0.35)})`;ctx.fill()}addN(ctx,w,h,ra2(0.05,0.16));break}
    case"desert":{const s=ra2(0.88,1.12);gd([200*s,170*s,120*s],[170*s,140*s,90*s]);const n=ri2(18,45);for(let i=0;i<n;i++){const cx=ra2(0,w),cy=ra2(0,h),r=ra2(3,w*0.16);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=`rgba(${ri2(140,200)},${ri2(110,170)},${ri2(50,110)},${ra2(0.12,0.5)})`;ctx.fill()}for(let i=0;i<ri2(6,20);i++){ctx.strokeStyle=`rgba(${ri2(170,230)},${ri2(140,200)},${ri2(90,150)},${ra2(0.08,0.3)})`;ctx.lineWidth=ra2(0.4,2.5);ctx.beginPath();let cx=ra2(0,w),cy=ra2(0,h);ctx.moveTo(cx,cy);for(let j=0;j<ri2(2,7);j++){cx+=ra2(-w*0.25,w*0.25);cy+=ra2(-h*0.12,h*0.12);ctx.lineTo(cx,cy)}ctx.stroke()}addN(ctx,w,h,ra2(0.05,0.16));break}
    case"tundra":{const s=ra2(0.9,1.1);gd([210*s,220*s,230*s],[170*s,180*s,200*s]);const n=ri2(12,35);for(let i=0;i<n;i++){const cx=ra2(0,w),cy=ra2(0,h),r=ra2(3,w*0.2);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=`rgba(${ri2(170,220)},${ri2(180,230)},${ri2(200,250)},${ra2(0.1,0.45)})`;ctx.fill()}for(let i=0;i<ri2(6,18);i++){ctx.strokeStyle=`rgba(${ri2(110,170)},${ri2(130,190)},${ri2(160,220)},${ra2(0.12,0.35)})`;ctx.lineWidth=ra2(0.4,2.2);ctx.beginPath();let cx=ra2(0,w),cy=ra2(0,h);ctx.moveTo(cx,cy);for(let j=0;j<ri2(3,9);j++){cx+=ra2(-w*0.12,w*0.12);cy+=ra2(-h*0.1,h*0.1);ctx.lineTo(cx,cy)}ctx.stroke()}addN(ctx,w,h,ra2(0.03,0.12));break}
  }
  return ctx.getImageData(0,0,w,h)
}
function addN(ctx:CanvasRenderingContext2D,w:number,h:number,s:number){const img=ctx.getImageData(0,0,w,h);const d=img.data;for(let i=0;i<d.length;i+=4){if(Math.random()<0.35){d[i]=Math.max(0,Math.min(255,d[i]+ra(-20,20)*s));d[i+1]=Math.max(0,Math.min(255,d[i+1]+ra(-20,20)*s));d[i+2]=Math.max(0,Math.min(255,d[i+2]+ra(-20,20)*s))}}ctx.putImageData(img,0,0)}

// ════════════════════════════════════════════════════
// 球体
// ════════════════════════════════════════════════════

function drawSphere(ctx:CanvasRenderingContext2D,data:ImageData,cx:number,cy:number,r:number,rot:number,alpha:number){
  if(r<3||alpha<0.01)return
  ctx.save();ctx.globalAlpha=Math.min(1,alpha);ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip()
  const tw=data.width,th=data.height,src=data.data,dpr=2,ss=Math.round(r*2*dpr);if(ss<4)return
  const ball=document.createElement("canvas");ball.width=ss;ball.height=ss
  const bctx=ball.getContext("2d")!;const dst=bctx.createImageData(ss,ss);const dd=dst.data,half=ss/2
  for(let dy=0;dy<ss;dy++)for(let dx=0;dx<ss;dx++){
    const nx=(dx+0.5)/half-1,ny=(dy+0.5)/half-1,d2=nx*nx+ny*ny;if(d2>1)continue
    const dist=Math.sqrt(d2),ea=dist>0.78?sst(1,0.78,dist):1,nz=Math.sqrt(1-d2)
    const u=(Math.atan2(nx,nz)/(2*Math.PI)+0.5+rot)%1,v=Math.acos(Math.max(-1,Math.min(1,ny)))/Math.PI
    const tx=Math.floor(u*tw)%tw,ty=Math.floor(v*th)%th,si=(ty*tw+tx)*4,di=(dy*ss+dx)*4
    const a=alpha*ea*(src[si+3]??255)/255
    dd[di]=Math.round(src[si]*a);dd[di+1]=Math.round(src[si+1]*a);dd[di+2]=Math.round(src[si+2]*a);dd[di+3]=Math.round(alpha*ea*(src[si+3]??255))
  }
  bctx.putImageData(dst,0,0)
  bctx.save();bctx.globalCompositeOperation="source-atop"
  const hh=half
  const g1=bctx.createRadialGradient(hh*0.35,hh*0.3,0,hh*0.35,hh*0.3,hh*0.7);g1.addColorStop(0,"rgba(255,255,255,0.15)");g1.addColorStop(0.3,"rgba(255,255,255,0.05)");g1.addColorStop(0.6,"rgba(0,0,0,0)");g1.addColorStop(1,"rgba(0,0,0,0)");bctx.fillStyle=g1;bctx.beginPath();bctx.arc(hh,hh,hh,0,Math.PI*2);bctx.fill()
  const g2=bctx.createRadialGradient(hh*0.4,hh*0.4,hh*0.3,hh,hh,hh*0.95);g2.addColorStop(0,"rgba(0,0,0,0)");g2.addColorStop(0.5,"rgba(0,0,0,0.02)");g2.addColorStop(0.8,"rgba(0,0,0,0.1)");g2.addColorStop(1,"rgba(0,0,0,0.3)");bctx.fillStyle=g2;bctx.beginPath();bctx.arc(hh,hh,hh,0,Math.PI*2);bctx.fill()
  const g3=bctx.createRadialGradient(hh*0.7,hh*0.7,hh*0.1,hh*0.75,hh*0.75,hh*0.6);g3.addColorStop(0,"rgba(0,0,0,0.12)");g3.addColorStop(0.5,"rgba(0,0,0,0.06)");g3.addColorStop(1,"rgba(0,0,0,0)");bctx.fillStyle=g3;bctx.beginPath();bctx.arc(hh,hh,hh,0,Math.PI*2);bctx.fill()
  bctx.restore()
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(ball,cx-r,cy-r,r*2,r*2)
  ctx.restore()
}



// ════════════════════════════════════════════════════
// 创建
// ════════════════════════════════════════════════════

function makeStar():Star{return{x:ra(-1.5,1.5),y:ra(-1.5,1.5),z:ra(2,12),size:ra(0.08,0.4),hue:ra(200,330),twP:ra(0,Math.PI*2),twS:ra(0.5,3),flare:Math.random()<0.02}}
function makeDSO(W:number,H:number,SS:number):DSO{const hue=Math.random()<0.4?ra(200,280):Math.random()<0.6?ra(0,40):ra(180,360);const sz=ra(2,12)*(SS/800);return{sx:ra(0,W),sy:ra(0,H),size:sz,hue,sat:ra(20,50),light:ra(40,65),alpha:ra(0.03,0.1),rot:ra(0,Math.PI*2),stretch:ra(0.3,0.8),ps:ra(0.2,1),pp:ra(0,Math.PI*2)}}
function makeAurora():Aurora{const ahue=Math.random()<0.5?ra(90,170):Math.random()<0.7?ra(260,310):ra(0,30);return{x:ra(-0.3,1.3),y:ra(0.05,0.95),w:ra(0.3,0.6),h2:ra(0.35,0.7),hue:ahue,sat:ra(70,100),light:ra(55,85),alpha:ra(0.08,0.2),wp:ra(0,Math.PI*2),wf:ra(1.5,4),wa:ra(0.04,0.15),ds:ra(-0.0004,0.0004),stretch:ra(0.05,0.12)}}
function makeNeb():Nebula{return{x:ra(-1.5,1.5),y:ra(-1.2,1.2),size:ra(0.3,0.9),hue:ra(0,360),sat:ra(40,80),light:ra(35,60),opacity:ra(0.05,0.12),sx:0,sy:0,rot:ra(0,Math.PI*2),dr:ra(-0.003,0.003),wp:ra(0,Math.PI*2)}}

function makePlanet():Planet{
  const types:PT[]=["rocky","gas","ice","volcanic","ocean","lava","desert","tundra"]
  const type=types[ri(0,types.length-1)]
  const tex=genTex(type,ri(1,99999))
  return{
    travel:0,speed:0,
    delay:ri(60,300),
    angle:ra(0,Math.PI*2),
    spawnT:ra(0.05,0.6),
    maxRadius:type==="gas"?ra(0.18,0.4):ra(0.08,0.28),
    pp:0,
    type,hue:ra(0,360),
    rot:ra(0,1),rotS:ra(0.003,0.012),tex
  }
}

// ════════════════════════════════════════════════════
// 渲染器
// ════════════════════════════════════════════════════

export const preset:PresetModule={
  definition:{id:"cosmic-warp",name:"穿梭宇宙",icon:"🌌",description:"星际穿梭"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number,dsoInit=false
    const dsoList:DSO[]=[],stars:Star[]=[],auroras:Aurora[]=[],nebs:Nebula[]=[],planets:Planet[]=[]

    for(let i=0;i<STAR_COUNT;i++)stars.push(makeStar())
    for(let i=0;i<AURORA_COUNT;i++)auroras.push(makeAurora())
    for(let i=0;i<NEBULA_COUNT;i++)nebs.push(makeNeb())

    // ★★ 8 颗行星池 — 速度与 spawnT 绑定
    // spawnT小=远=慢速, spawnT大=近=快速（投影近处角速度更快）
    // 保证远星永远不会追上近星，层次不乱
    for(let i=0;i<PLANET_COUNT;i++){
      const p=makePlanet()
      p.speed=0.003+p.spawnT*0.008
      if(i<3){
        p.delay=0
        p.travel=ra(p.spawnT,Math.min(0.75,p.spawnT+0.4))
      }
      planets.push(p)
    }

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0

    function resize(){
      const dpr=window.devicePixelRatio||1
      canvas.width=window.innerWidth*dpr;canvas.height=window.innerHeight*dpr
      canvas.style.width=`${window.innerWidth}px`;canvas.style.height=`${window.innerHeight}px`
      ctx.setTransform(dpr,0,0,dpr,0,0);dsoInit=false
    }
    resize();window.addEventListener("resize",resize)

    function draw(){
      if(stopped)return;raf=requestAnimationFrame(draw);frame++

      const W=window.innerWidth,H=window.innerHeight,CX=W/2,CY=H/2,SS=Math.min(W,H)

      if(!dsoInit){dsoList.length=0;for(let i=0;i<DSO_COUNT;i++)dsoList.push(makeDSO(W,H,SS));dsoInit=true}

      if(analyser&&playing){
        analyser.getByteFrequencyData(freq);const L=freq.length;let sum=0;for(let i=0;i<L;i++)sum+=freq[i]
        avgE=avgE*0.85+(sum/L/255)*0.15;const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4;const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}
      const speed=0.008+bass*0.04+mid*0.015

      // ─── 全屏底色 ───
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.8)
      bg.addColorStop(0,"rgba(20,10,35,1)");bg.addColorStop(0.3,"rgba(16,8,28,1)");bg.addColorStop(0.6,"rgba(12,6,22,1)");bg.addColorStop(1,"rgba(8,4,16,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)
      const glumes=[
        [W*0.08,H*0.8,SS*0.8,140,55,38,0.06+avgE*0.06],
        [W*0.9,H*0.15,SS*0.7,220,60,35,0.05+avgE*0.05],
        [CX*0.4,H*1.2,SS*0.7,280,50,30,0.04+avgE*0.04+bass*0.03],
        [W*0.15,H*0.2,SS*0.5,20,50,28,0.035+avgE*0.03],
        // 新增：上层暖色极光辉光
        [W*0.5,CY*0.1,SS*0.35,320,60,40,0.03+avgE*0.03],
        // 新增：右边紫色辉光
        [W*0.85,CY*0.6,SS*0.45,260,55,35,0.035+avgE*0.04+bass*0.02],
      ]as[number,number,number,number,number,number,number][]
      for(const g of glumes){const a=ctx.createRadialGradient(g[0],g[1],0,g[0],g[1],g[2]);a.addColorStop(0,`hsla(${g[3]},${g[4]}%,${g[5]}%,${g[6]})`);a.addColorStop(0.5,`hsla(${g[3]+10},${g[4]*0.7}%,${g[5]-5}%,${g[6]*0.5})`);a.addColorStop(1,"hsla(0,0%,0%,0)");ctx.fillStyle=a;ctx.fillRect(0,0,W,H)}

      // ─── 深场星系 ───
      for(const d of dsoList){
        d.pp+=0.005*d.ps;const pulse=0.8+Math.sin(d.pp)*0.2,sz=d.size*pulse;if(sz<1)continue
        ctx.save();ctx.translate(d.sx,d.sy);ctx.rotate(d.rot);ctx.scale(d.stretch,1)
        const dg=ctx.createRadialGradient(0,0,0,0,0,sz)
        dg.addColorStop(0,`hsla(${d.hue},${d.sat}%,${d.light+15}%,${d.alpha*pulse*0.8})`);dg.addColorStop(0.3,`hsla(${d.hue+5},${d.sat*0.7}%,${d.light+5}%,${d.alpha*pulse*0.5})`);dg.addColorStop(0.6,`hsla(${d.hue+10},${d.sat*0.4}%,${d.light-5}%,${d.alpha*pulse*0.2})`);dg.addColorStop(1,`hsla(${d.hue+15},${d.sat*0.2}%,${d.light-10}%,0)`)
        ctx.fillStyle=dg;ctx.beginPath();ctx.arc(0,0,sz,0,Math.PI*2);ctx.fill();ctx.restore()
      }

      // ─── 银河带 ───
      ctx.save();ctx.translate(CX,CY*0.92);ctx.rotate(0.3)
      const mw=ctx.createRadialGradient(0,0,0,0,0,SS*0.5)
      mw.addColorStop(0,`hsla(260,35%,30%,${0.04+avgE*0.04})`);mw.addColorStop(0.3,`hsla(255,25%,22%,${0.05+avgE*0.04})`);mw.addColorStop(0.6,`hsla(245,18%,16%,${0.035+avgE*0.03})`);mw.addColorStop(1,"hsla(0,0%,0%,0)");ctx.fillStyle=mw;ctx.scale(1,0.1);ctx.beginPath();ctx.arc(0,0,SS*0.55,0,Math.PI*2);ctx.fill();ctx.restore()

      // ─── 极光幕 ───
      for(const a of auroras){
        a.wp+=0.012*(1+bass*0.4);a.x+=a.ds;if(a.x>1.4)a.x=-0.4;if(a.x<-0.4)a.x=1.4;const bands=20
        for(let bi=0;bi<bands;bi++){const bx=a.x+(bi/bands)*a.w;if(bx<-0.1||bx>1.1)continue;const sx=bx*W,wav=Math.sin(bi*a.wf+a.wp)*a.wa*W,wav2=Math.sin(bi*a.wf*0.5+a.wp*0.7)*a.wa*W*0.5;const inty=1-Math.abs(bi/bands-0.5)*1.3;if(inty<=0)continue;const yy=(a.y-a.h2/2)*H,yb=(a.y+a.h2/2)*H,yw=Math.sin(a.wp*0.5+bi*0.3)*a.h2*H*0.1;const cy=(yy+yb)/2+yw,bH=yb-yy,aa=a.alpha*inty*(1+avgE*0.5+bass*0.3);const xPos=sx+wav+wav2;const ag=ctx.createRadialGradient(xPos,cy,0,xPos,cy,bH*0.7);ag.addColorStop(0,`hsla(${a.hue},${a.sat}%,${a.light+15}%,${aa})`);ag.addColorStop(0.3,`hsla(${a.hue+5},${a.sat*0.8}%,${a.light+5}%,${aa*0.6})`);ag.addColorStop(0.6,`hsla(${a.hue+10},${a.sat*0.5}%,${a.light-5}%,${aa*0.25})`);ag.addColorStop(1,`hsla(${a.hue+15},${a.sat*0.3}%,${a.light-10}%,0)`);ctx.fillStyle=ag;ctx.save();ctx.translate(xPos,cy);ctx.scale(1,a.stretch*6);ctx.beginPath();ctx.arc(0,0,Math.max(5,(a.w/bands)*W*0.8),0,Math.PI*2);ctx.fill();ctx.restore()}
      }

      // ─── 星云 ───
      for(const n of nebs){
        n.wp+=0.005;n.rot+=n.dr;const ns2=n.size*SS*0.15;if(ns2<5)continue;n.sx=CX+n.x*W*0.2;n.sy=CY+n.y*H*0.15
        ctx.save();ctx.translate(n.sx,n.sy);ctx.rotate(n.rot);const pulse=1+Math.sin(n.wp)*0.1;ctx.scale(1.5*pulse,1)
        const na=n.opacity*(1+avgE*0.8);const nb=ctx.createRadialGradient(0,0,0,0,0,ns2)
        nb.addColorStop(0,`hsla(${n.hue},${n.sat}%,${n.light+15}%,${na})`);nb.addColorStop(0.4,`hsla(${n.hue+10},${n.sat*0.8}%,${n.light+5}%,${na*0.6})`);nb.addColorStop(0.7,`hsla(${n.hue+20},${n.sat*0.5}%,${n.light-5}%,${na*0.2})`);nb.addColorStop(1,`hsla(${n.hue+30},${n.sat*0.3}%,${n.light-10}%,0)`)
        ctx.fillStyle=nb;ctx.beginPath();ctx.arc(0,0,ns2,0,Math.PI*2);ctx.fill();ctx.restore()
      }

      // ─── 星场 ───
      for(const s of stars){
        s.z-=speed*(0.5+s.twS*0.08);s.twP+=0.035*s.twS*(1+bass)
        if(s.z<=0.2){Object.assign(s,makeStar());continue}
        const sx=CX+(s.x/s.z)*W*0.6,sy=CY+(s.y/s.z)*H*0.5*0.5
        if(sx<-30||sx>W+30||sy<-30||sy>H+30){Object.assign(s,makeStar());continue}
        let sz2=Math.min(5,s.size*(1/Math.max(0.18,s.z))*0.007*SS)
        const tw=Math.sin(s.twP)*0.35+0.65,db=Math.min(1,(12-s.z)/12*2.2),al=db*(0.35+avgE*0.25)*tw
        const hue=s.hue-(1-s.z/12)*25,lt=45+(1-s.z/12)*45+avgE*12
        if(sz2>0.15){
          const gf=sst(0.2,2.0,sz2);const gr=Math.min(sz2*2.2,14)*gf;const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,gr)
          sg.addColorStop(0,`hsla(${hue},65%,${lt+12}%,${al*0.18*gf})`);sg.addColorStop(0.5,`hsla(${hue+10},45%,${lt+3}%,${al*0.05*gf})`);sg.addColorStop(1,`hsla(${hue+20},35%,${lt}%,0)`);ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sx,sy,gr,0,Math.PI*2);ctx.fill()
          ctx.beginPath();ctx.arc(sx,sy,Math.max(0.25,sz2*0.65*gf),0,Math.PI*2);ctx.fillStyle=`hsla(${hue},45%,${lt+18}%,${al*0.75})`;ctx.fill()
          if(s.flare&&sz2>1.5&&db>0.5&&gf>0.5){const fl=sz2*3*gf,fa=al*0.2*gf;ctx.strokeStyle=`hsla(${hue},30%,100%,${fa})`;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(sx-fl,sy);ctx.lineTo(sx+fl,sy);ctx.moveTo(sx,sy-fl);ctx.lineTo(sx,sy+fl);ctx.stroke();ctx.lineWidth=0.3;const fd=fl*0.5;ctx.strokeStyle=`hsla(${hue},20%,100%,${fa*0.5})`;ctx.beginPath();ctx.moveTo(sx-fd,sy-fd);ctx.lineTo(sx+fd,sy+fd);ctx.moveTo(sx+fd,sy-fd);ctx.lineTo(sx-fd,sy+fd);ctx.stroke()}
        }
      }

      // ═══════════════════════════════════════════════════════════
      // 星球——单颗渐进，从远处正中 → 侧面消失
      // ═══════════════════════════════════════════════════════════

      // ── 延迟倒计时 ──
      for(const p of planets)if(p.delay>0)p.delay--

      // 按 travel 从远到近
      const sorted=[...planets].filter(p=>p.delay===0).sort((a,b)=>a.pp-b.pp)

      for(const p of sorted){
        // ── 更新 ──
        p.travel+=p.speed*(0.3+bass*0.8)
        p.rot+=p.rotS*(1+bass)

        // 走完全程 → 回收
        if(p.travel>=1){
          Object.assign(p,makePlanet())
          p.speed=0.003+p.spawnT*0.008
          p.delay=ri(90,300)
          p.travel=0
          continue
        }

        // ── 可见判断 ──
        const t=p.travel
        if(t<p.spawnT)continue // 还没到出现点

        // ── 位置：从 spawnT 出现到 travel=1 到屏幕边缘 ──
        // 在射线上：spawnT 时离中心较近，1 时到屏幕边缘
        const edgeDist=Math.max(W,H)*0.5 // 到边缘的距离（保证上下左右都能到边）
        const posProgress=(t-p.spawnT)/(1-p.spawnT) // 0→1 在可见区间内
        const radiusDist=posProgress*edgeDist
        const sx=CX+Math.cos(p.angle)*radiusDist
        const sy=CY+Math.sin(p.angle)*radiusDist

        // 屏幕外跳过
        if(sx<-W*0.3||sx>W*1.3||sy<-H*0.3||sy>H*1.3)continue

        // ── 位置进度（存到 planet 用于排序） ──
        p.pp=(t-p.spawnT)/(1-p.spawnT)
        const pp=p.pp

        // ── 大小：单调增长直到出画 ──
        // 从出现到边缘，越走越近，越来越大
        // 到屏幕边缘时最大，被屏幕边框切掉，自然消失
        const sizeCurve=Math.min(1,Math.pow(pp*1.3,1.5))
        const r=p.maxRadius*SS*0.5*sizeCurve
        if(r<1.5)continue

        // ── 透明度：淡入后全程保持 ──
        let alpha:number
        if(pp<0.03)alpha=sst(0,0.03,pp)
        else alpha=1

        if(alpha<0.005)continue

        // ── 渲染 ──

        // 光点（小的时候）
        if(sizeCurve<0.15){
          const dotA=alpha
          if(dotA>0.003){
            ctx.beginPath();ctx.arc(sx,sy,Math.max(1,r*0.8),0,Math.PI*2)
            ctx.fillStyle=`hsla(${p.hue+20},55%,70%,${dotA})`
            ctx.fill()
          }
        }

        // 光晕（中等大小时）
        if(sizeCurve>0.08&&sizeCurve<0.45){
          const glowA=alpha*0.25
          if(glowA>0.005){
            const gd=ctx.createRadialGradient(sx,sy,r*0.3,sx,sy,r*3)
            gd.addColorStop(0,`hsla(${p.hue+20},60%,70%,${glowA*0.5})`)
            gd.addColorStop(0.5,`hsla(${p.hue+10},45%,55%,${glowA*0.2})`)
            gd.addColorStop(1,"hsla(0,0%,0%,0)");ctx.fillStyle=gd;ctx.beginPath();ctx.arc(sx,sy,r*3,0,Math.PI*2);ctx.fill()
          }
        }

        // 球体（足够大 + 纹理可见）
        if(sizeCurve>0.2&&r>=4){
          const r2=Math.max(4,r)

          if(p.tex){
            const ballA=alpha*(sizeCurve<0.3?sst(0.2,0.3,sizeCurve):1)
            // 外光晕
            const og=ctx.createRadialGradient(sx,sy,r2*0.1,sx,sy,r2*2)
            og.addColorStop(0,`hsla(${p.hue},60%,65%,${ballA*(0.006+bass*0.015)})`)
            og.addColorStop(0.4,`hsla(${p.hue+15},45%,50%,${ballA*(0.002+bass*0.004)})`)
            og.addColorStop(1,"hsla(0,0%,0%,0)");ctx.fillStyle=og;ctx.beginPath();ctx.arc(sx,sy,r2*2,0,Math.PI*2);ctx.fill()

            drawSphere(ctx,p.tex,sx,sy,r2,p.rot,ballA)
          }else{
            ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(sx,sy,r2,0,Math.PI*2);ctx.fillStyle=`hsla(${p.hue},50%,50%,0.8)`;ctx.fill();ctx.restore()
          }
        }

        // 大气辉光（大时）
        if(r>15&&sizeCurve>0.3){
          const ag=ctx.createRadialGradient(sx,sy,r*0.7,sx,sy,r*1.2)
          ag.addColorStop(0,"rgba(255,255,255,0)")
          ag.addColorStop(0.7,`hsla(${p.hue+30},45%,70%,${alpha*(0.003+bass*0.004)})`)
          ag.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=ag;ctx.beginPath();ctx.arc(sx,sy,r*1.2,0,Math.PI*2);ctx.fill()
        }
      }

      // ─── 能量柱 ───
      if(analyser&&playing&&freq.length>0){
        const step=Math.max(1,Math.floor(freq.length/48)),maxH=H*0.06,bw=3,gap=1,tw=48*(bw+gap),startsx=(W-tw)/2
        for(let i=0;i<48;i++){let s=0;const st=i*step,en=Math.min(st+step,freq.length);for(let j=st;j<en;j++)s+=freq[j];const n=s/(en-st)/255,bh=Math.max(1,n*maxH),x=startsx+i*(bw+gap),y=H-bh;ctx.fillStyle=`hsla(${265-n*170},70%,${40+n*20}%,${0.15+n*0.15})`;ctx.fillRect(x,y,bw,bh)}
      }
    }
    draw()
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize)}
  },
}

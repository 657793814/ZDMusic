/* 🌀 WORMHOLE TRANSIT — 虫洞穿梭
 *
 * 从圆形隧道内部视角，径向光条向中心汇聚
 * - 隧道壁纹理旋转扭曲，景深感极强
 * - 音频→扭曲度/速度随节奏变化
 * - 视觉类似《星际穿越》虫洞效果
 *
 * 结构：
 * - 圆形隧道主体（径向渐变环）
 * - 隧道壁发光条纹（旋转扭曲）
 * - 中心亮点（出口）
 * - 星光沿隧道壁流动
 * - 外围星场
 *
 * 音频驱动：
 * - bass → 隧道旋转速度、扭曲强度
 * - mid → 光流速度、细节
 * - avgE → 整体亮度
 */

import type { PresetModule } from "./types";

interface WHStar{angle:number;radius:number;size:number;hue:number;bright:number;speed:number}
interface TunnelRing{radius:number;width:number;hue:number;sat:number;light:number;alpha:number;twistOffset:number}

const STAR_COUNT=400,RING_COUNT=20,TUNNEL_STARS=300

const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const sst=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)}

function makeStar():WHStar{return{angle:ra(0,Math.PI*2),radius:ra(0.25,0.95),size:ra(0.5,2.5),hue:ra(200,350),bright:ra(0.3,1),speed:ra(0.003,0.015)}}
function makeRing(i:number):TunnelRing{
  const r=0.05+(i/RING_COUNT)*0.85
  return{
    radius:r,width:ra(0.01,0.04),
    hue:ri(220,280)+(i%2===0?30:0),sat:ri(60,90),light:ri(40,70),
    alpha:ra(0.05,0.2)*(1-r),twistOffset:ra(0,Math.PI*2)
  }
}

export const preset:PresetModule={
  definition:{id:"wormhole",name:"虫洞穿梭",icon:"🌀",description:"时空隧道内部视角"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const stars:WHStar[]=[],rings:TunnelRing[]=[],tStars:WHStar[]=[]

    for(let i=0;i<STAR_COUNT;i++)stars.push(makeStar())
    for(let i=0;i<RING_COUNT;i++)rings.push(makeRing(i))
    for(let i=0;i<TUNNEL_STARS;i++){
      tStars.push({angle:ra(0,Math.PI*2),radius:ra(0.05,0.9),size:ra(0.3,2),hue:ra(200,350),bright:ra(0.2,0.8),speed:ra(0.002,0.01)})
    }

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0,rot=0

    function resize(){
      const dpr=window.devicePixelRatio||1
      canvas.width=window.innerWidth*dpr;canvas.height=window.innerHeight*dpr
      canvas.style.width=`${window.innerWidth}px`;canvas.style.height=`${window.innerHeight}px`
      ctx.setTransform(dpr,0,0,dpr,0,0)
    }
    resize();window.addEventListener("resize",resize)

    function draw(){
      if(stopped)return;raf=requestAnimationFrame(draw);frame++

      const W=window.innerWidth,H=window.innerHeight,CX=W/2,CY=H/2,SS=Math.min(W,H)
      const maxR=Math.max(W,H)*0.48

      if(analyser&&playing){
        analyser.getByteFrequencyData(freq);const L=freq.length;let sum=0;for(let i=0;i<L;i++)sum+=freq[i]
        avgE=avgE*0.85+(sum/L/255)*0.15;const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4;const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}

      rot+=0.005+bass*0.02

      // ─── 背景 ───
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.6)
      bg.addColorStop(0,"rgba(0,0,0,1)");bg.addColorStop(0.3,"rgba(3,2,12,1)");bg.addColorStop(0.7,"rgba(8,5,18,1)");bg.addColorStop(1,"rgba(5,3,12,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // ─── 外围星场 ───
      for(const s of stars){
        s.angle+=s.speed*(1+mid)
        const sx=CX+Math.cos(s.angle)*s.radius*maxR,sy=CY+Math.sin(s.angle)*s.radius*maxR
        const sz=s.size*(0.3+avgE*0.5)
        ctx.beginPath();ctx.arc(sx,sy,Math.max(0.3,sz),0,Math.PI*2)
        ctx.fillStyle=`hsla(${s.hue},50%,${60+s.bright*30}%,${s.bright*0.4*(0.5+avgE)})`
        ctx.fill()
      }

      // ─── 隧道 ───
      ctx.save();ctx.translate(CX,CY)

      // 隧道壁底色
      const tb=ctx.createRadialGradient(0,0,0,0,0,maxR)
      tb.addColorStop(0,"rgba(30,20,60,0.1)")
      tb.addColorStop(0.3,`rgba(20,15,50,${0.1+avgE*0.1})`)
      tb.addColorStop(0.6,`rgba(15,10,40,${0.08+avgE*0.08})`)
      tb.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=tb;ctx.beginPath();ctx.arc(0,0,maxR,0,Math.PI*2);ctx.fill()

      // 环
      for(const r of rings){
        const twist=Math.sin(r.twistOffset+rot*0.5)*r.radius*0.15
        const rr=r.radius*maxR
        const ra=r.alpha*(0.4+avgE*0.4)
        if(ra<0.003)continue
        // 旋转角度扭曲
        const aOff=rot*(1-r.radius)+twist
        // 绘制环弧段
        const segs=120
        const rw=r.width*maxR
        for(let si=0;si<segs;si++){
          const a0=(si/segs)*Math.PI*2+aOff,a1=((si+1)/segs)*Math.PI*2+aOff
          const p0x=Math.cos(a0)*rr,p0y=Math.sin(a0)*rr
          const p1x=Math.cos(a1)*rr,p1y=Math.sin(a1)*rr
          const p2x=Math.cos(a1)*(rr+rw),p2y=Math.sin(a1)*(rr+rw)
          const p3x=Math.cos(a0)*(rr+rw),p3y=Math.sin(a0)*(rr+rw)
          const segAlpha=ra*0.5*(1+r.radius)+(0.5+Math.sin(a0*3+frame*0.03)*0.3)*ra*0.5
          ctx.beginPath();ctx.moveTo(p0x,p0y);ctx.lineTo(p1x,p1y);ctx.lineTo(p2x,p2y);ctx.lineTo(p3x,p3y);ctx.closePath()
          ctx.fillStyle=`hsla(${r.hue+si*0.5},${r.sat}%,${r.light+Math.sin(si*0.1)*10}%,${segAlpha})`
          ctx.fill()
        }
      }

      // 隧道星光
      for(const ts of tStars){
        ts.angle+=ts.speed*(1+bass+mid*0.5)*(1-ts.radius*0.5)
        const twist2=Math.sin(frame*0.01+ts.angle)*ts.radius*0.1
        const tr=ts.radius*maxR
        const tx=Math.cos(ts.angle+rot*0.3*(1-ts.radius)+twist2)*tr
        const ty=Math.sin(ts.angle+rot*0.3*(1-ts.radius)+twist2)*tr
        const tsAlpha=ts.bright*(0.2+avgE*0.3)*(1-ts.radius*0.5)
        if(tsAlpha<0.005)continue
        ctx.beginPath();ctx.arc(tx,ty,ts.size*(0.3+avgE*0.3),0,Math.PI*2)
        ctx.fillStyle=`hsla(${ts.hue},60%,70%,${tsAlpha})`
        ctx.fill()
      }

      // 中心出口光
      const exitA=0.1+bass*0.2+avgE*0.15
      const eg=ctx.createRadialGradient(0,0,0,0,0,SS*0.08)
      eg.addColorStop(0,`rgba(255,255,255,${exitA})`)
      eg.addColorStop(0.2,`hsla(260,60%,70%,${exitA*0.6})`)
      eg.addColorStop(0.5,`hsla(220,50%,50%,${exitA*0.2})`)
      eg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=eg;ctx.beginPath();ctx.arc(0,0,SS*0.08,0,Math.PI*2);ctx.fill()

      ctx.restore()

      // ─── 能量柱 ───
      if(analyser&&playing&&freq.length>0){
        const step=Math.max(1,Math.floor(freq.length/48)),maxH=H*0.06,bw=3,gap=1,tw=48*(bw+gap),startsx=(W-tw)/2
        for(let i=0;i<48;i++){let s=0;const st=i*step,en=Math.min(st+step,freq.length);for(let j=st;j<en;j++)s+=freq[j];const n=s/(en-st)/255,bh=Math.max(1,n*maxH),x=startsx+i*(bw+gap),y=H-bh;ctx.fillStyle=`hsla(${240-n*120},70%,${40+n*30}%,${0.1+n*0.15})`;ctx.fillRect(x,y,bw,bh)}
      }
    }
    draw()
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize)}
  },
}

/* 💠 CYBER RING — 赛博星环
 *
 * 倾斜行星环系统，发光网格纹理
 * - 霓虹蓝/紫/粉色，Tron 风格
 * - 环旋转速度、发光动态随音频变化
 * - 未来感，电子乐绝配
 *
 * 结构：
 * - 中心发光的核心球体（半透明网格球）
 * - 多层倾斜光环（发光环带）
 * - 光环上的网格纹理
 * - 粒子沿光环流动
 * - 发光网格线投影
 *
 * 音频驱动：
 * - bass → 旋转速度、发光强度
 * - mid → 粒子流速
 * - avgE → 环亮度
 */

import type { PresetModule } from "./types";

interface CRRing{tiltX:number;tiltZ:number;radius:number;width:number;hue:number;bright:number;speed:number;phase:number;segments:number}
interface CRPart{angle:number;radius:number;size:number;hue:number;bright:number;speed:number}

const RING_COUNT=5,PART_COUNT=200,STAR_COUNT=300

const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const sst=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)}

function makeRing(i:number):CRRing{return{tiltX:ra(-0.5,0.5),tiltZ:ra(-0.4,0.4),radius:0.2+i*0.12,width:ra(0.02,0.06),hue:ri(240,300)+(i%2===0?30:-10),bright:ra(0.4,0.8),speed:ra(0.003,0.009),phase:ra(0,Math.PI*2),segments:ri(40,80)}}
function makePart():CRPart{return{angle:ra(0,Math.PI*2),radius:ra(0.2,0.7),size:ra(0.3,2),hue:ra(200,300),bright:ra(0.2,0.8),speed:ra(0.003,0.015)}}

export const preset:PresetModule={
  definition:{id:"cyber-ring",name:"赛博星环",icon:"💠",description:"霓虹发光行星环"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    let rings=Array.from({length:RING_COUNT},(_,i)=>makeRing(i))
    const parts=Array.from({length:PART_COUNT},()=>makePart())

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

      if(analyser&&playing){
        analyser.getByteFrequencyData(freq);const L=freq.length;let sum=0;for(let i=0;i<L;i++)sum+=freq[i]
        avgE=avgE*0.85+(sum/L/255)*0.15;const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4;const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}

      rot+=0.003+bass*0.015

      // ─── 背景 ───
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.6)
      bg.addColorStop(0,"rgba(5,3,12,1)");bg.addColorStop(0.5,"rgba(8,4,18,1)");bg.addColorStop(1,"rgba(2,1,8,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // ─── 核心球体（发光半透明网格球） ───
      ctx.save();ctx.translate(CX,CY)
      const coreA=0.3+avgE*0.2+bass*0.15
      const coreR=SS*0.1
      const cg=ctx.createRadialGradient(0,0,0,0,0,coreR*2)
      cg.addColorStop(0,`hsla(260,80%,70%,${coreA*0.6})`)
      cg.addColorStop(0.3,`hsla(280,70%,55%,${coreA*0.3})`)
      cg.addColorStop(0.7,`hsla(240,60%,40%,${coreA*0.1})`)
      cg.addColorStop(1,"hsla(0,0%,0%,0)")
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(0,0,coreR*2,0,Math.PI*2);ctx.fill()

      // 核心网格线
      ctx.strokeStyle=`hsla(260,70%,60%,${coreA*0.3})`;ctx.lineWidth=0.5
      for(let i=0;i<12;i++){
        const a=(i/12)*Math.PI*2+rot
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*coreR,Math.sin(a)*coreR);ctx.stroke()
      }

      // ─── 光环 ───
      for(const r of rings){
        const rBright=r.bright*(0.3+avgE*0.5+bass*0.2)
        if(rBright<0.02)continue
        const rRot=rot*r.speed

        ctx.save()
        ctx.rotate(r.tiltX*0.5)
        ctx.scale(1,0.5+r.tiltZ*0.1)
        ctx.rotate(rRot)

        const rR=r.radius*SS*0.45
        const rW=r.width*SS*0.3

        for(let si=0;si<r.segments;si++){
          const a0=(si/r.segments)*Math.PI*2,a1=((si+1)/r.segments)*Math.PI*2
          const pulse=0.5+Math.sin(a0*4+frame*0.03+r.phase)*0.5
          const segA=rBright*pulse*0.5
          if(segA<0.005)continue

          const p0x=Math.cos(a0)*rR,p0y=Math.sin(a0)*rR
          const p1x=Math.cos(a1)*rR,p1y=Math.sin(a1)*rR
          const p2x=Math.cos(a1)*(rR+rW),p2y=Math.sin(a1)*(rR+rW)
          const p3x=Math.cos(a0)*(rR+rW),p3y=Math.sin(a0)*(rR+rW)

          ctx.beginPath();ctx.moveTo(p0x,p0y);ctx.lineTo(p1x,p1y);ctx.lineTo(p2x,p2y);ctx.lineTo(p3x,p3y);ctx.closePath()
          ctx.fillStyle=`hsla(${r.hue},80%,${50+pulse*30}%,${segA})`
          ctx.fill()

          // 段间发光连线
          if(si%3===0){
            ctx.strokeStyle=`hsla(${r.hue+10},70%,70%,${segA*0.3})`;ctx.lineWidth=0.5
            ctx.beginPath();ctx.moveTo(p0x,p0y);ctx.lineTo(p1x,p1y);ctx.stroke()
          }
        }
        ctx.restore()
      }

      // ─── 流动粒子 ───
      for(const p of parts){
        p.angle+=p.speed*(1+bass+mid*0.5)
        const pr=p.radius*SS*0.45
        const px=Math.cos(p.angle+rot*p.speed)*pr
        const py=Math.sin(p.angle+rot*p.speed)*pr*0.5
        const pA=p.bright*(0.3+avgE*0.4+bass*0.2)
        if(pA<0.005)continue
        const sz=p.size*(0.3+avgE*0.5)
        ctx.beginPath();ctx.arc(px,py,Math.max(0.3,sz),0,Math.PI*2)
        ctx.fillStyle=`hsla(${p.hue},80%,70%,${pA})`
        ctx.fill()
        if(sz>0.5){
          const pg=ctx.createRadialGradient(px,py,0,px,py,sz*3)
          pg.addColorStop(0,`hsla(${p.hue},70%,60%,${pA*0.2})`);pg.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,sz*3,0,Math.PI*2);ctx.fill()
        }
      }

      ctx.restore()

      // ─── 能量柱 ───
      if(analyser&&playing&&freq.length>0){
        const step=Math.max(1,Math.floor(freq.length/48)),maxH=H*0.05,bw=3,gap=1,tw=48*(bw+gap),startsx=(W-tw)/2
        for(let i=0;i<48;i++){let s=0;const st=i*step,en=Math.min(st+step,freq.length);for(let j=st;j<en;j++)s+=freq[j];const n=s/(en-st)/255,bh=Math.max(1,n*maxH),x=startsx+i*(bw+gap),y=H-bh;ctx.fillStyle=`hsla(${260+n*60},80%,${40+n*30}%,${0.08+n*0.12})`;ctx.fillRect(x,y,bw,bh)}
      }
    }
    draw()
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize)}
  },
}

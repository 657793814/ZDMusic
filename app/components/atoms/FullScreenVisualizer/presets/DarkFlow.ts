// 🌫️ DARK FLOW — 暗物质流（增强版）
import type { PresetModule } from "./types";

interface DFFlow{
  points:{x:number;y:number}[];
  speed:number;
  width:number;
  hue:number;
  alpha:number;
  phase:number;
  particles:{t:number;size:number;bright:number}[];
}

const FLOW_COUNT=12,PARTICLES_PER_FLOW=40
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const sst=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t

function makeFlow():DFFlow{
  const pts:DFFlow["points"]=[]
  const cx=ra(-0.8,0.8),cy=ra(-0.8,0.8)
  for(let i=0;i<5;i++)pts.push({x:cx+ra(-0.3,0.3),y:cy+ra(-0.3,0.3)})
  const parts=[]
  for(let i=0;i<PARTICLES_PER_FLOW;i++)parts.push({t:i/PARTICLES_PER_FLOW,size:ra(1,5),bright:ra(0.4,1)})
  return{points:pts,speed:ra(0.003,0.008),width:ra(0.06,0.2),hue:ri(200,280),alpha:ra(0.15,0.35),phase:ra(0,Math.PI*2),particles:parts}
}

function bezier(pts:{x:number;y:number}[],t:number):{x:number;y:number}{
  if(pts.length===1)return pts[0]
  const next:{x:number;y:number}[]=[]
  for(let i=0;i<pts.length-1;i++)next.push({x:lerp(pts[i].x,pts[i+1].x,t),y:lerp(pts[i].y,pts[i+1].y,t)})
  return bezier(next,t)
}

export const preset:PresetModule={
  definition:{id:"dark-flow",name:"暗物质流",icon:"🌫️",description:"有机流动粒子丝线"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const flows:DFFlow[]=[]
    for(let i=0;i<FLOW_COUNT;i++)flows.push(makeFlow())

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0

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

      const speedMul=0.5+bass*1.5+mid*0.5

      // 背景
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.6)
      bg.addColorStop(0,"rgba(5,3,12,1)");bg.addColorStop(0.5,"rgba(8,5,18,1)");bg.addColorStop(1,"rgba(3,2,8,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // 流线
      for(const f of flows){
        const fAlpha=f.alpha*(0.5+avgE*0.5+bass*0.3)
        if(fAlpha<0.01)continue

        // 丝带路径 — 更粗更亮
        ctx.beginPath()
        const steps=60
        for(let si=0;si<=steps;si++){
          const t=si/steps
          const pt=bezier(f.points,t)
          const wave=Math.sin(t*Math.PI*4+frame*0.01+f.phase)*0.05
          const x=CX+(pt.x+wave)*SS*0.4
          const y=CY+(pt.y+Math.sin(t*Math.PI*3+frame*0.008+f.phase*1.3)*0.04)*SS*0.4
          if(si===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)
        }

        // 外层大辉光
        ctx.strokeStyle=`hsla(${f.hue+10},50%,60%,${fAlpha*0.2})`
        ctx.lineWidth=f.width*SS*0.6;ctx.stroke()

        // 中层主带
        ctx.strokeStyle=`hsla(${f.hue},60%,55%,${fAlpha*0.4})`
        ctx.lineWidth=f.width*SS*0.35;ctx.stroke()

        // 内层亮核
        ctx.strokeStyle=`hsla(${f.hue+5},80%,75%,${fAlpha*0.5})`
        ctx.lineWidth=f.width*SS*0.1;ctx.stroke()

        // 粒子沿路径流动
        for(const p of f.particles){
          p.t+=f.speed*speedMul
          if(p.t>1)p.t-=1
          const pt=bezier(f.points,p.t)
          const wave2=Math.sin(p.t*Math.PI*4+frame*0.01+f.phase)*0.05
          const px=CX+(pt.x+wave2)*SS*0.4
          const py=CY+(pt.y+Math.sin(p.t*Math.PI*3+frame*0.008+f.phase*1.3)*0.04)*SS*0.4
          const pAlpha=p.bright*fAlpha*(0.5+Math.sin(p.t*20+frame*0.05)*0.5)
          const sz=p.size*(0.5+avgE*0.5)
          if(pAlpha<0.01)continue
          ctx.beginPath();ctx.arc(px,py,Math.max(0.5,sz),0,Math.PI*2)
          ctx.fillStyle=`hsla(${f.hue+15},80%,80%,${pAlpha})`
          ctx.fill()
          // 辉光扩大
          const pg=ctx.createRadialGradient(px,py,0,px,py,sz*5)
          pg.addColorStop(0,`hsla(${f.hue+20},70%,70%,${pAlpha*0.25})`)
          pg.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,sz*5,0,Math.PI*2);ctx.fill()
        }
      }

      // --- 能量柱 ---
      if(analyser&&playing&&freq.length>0){
        const step=Math.max(1,Math.floor(freq.length/48)),maxH=H*0.05,bw=3,gap=1,tw=48*(bw+gap),startsx=(W-tw)/2
        for(let i=0;i<48;i++){let s=0;const st=i*step,en=Math.min(st+step,freq.length);for(let j=st;j<en;j++)s+=freq[j];const n=s/(en-st)/255,bh=Math.max(1,n*maxH),x=startsx+i*(bw+gap),y=H-bh;ctx.fillStyle=`hsla(${240-n*80},60%,${40+n*20}%,${0.08+n*0.12})`;ctx.fillRect(x,y,bw,bh)}
      }
    }
    draw()
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize)}
  },
}

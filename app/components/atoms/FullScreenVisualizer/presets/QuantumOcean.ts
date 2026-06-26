// 🌊 QUANTUM OCEAN — 量子海洋（增强版）
import type { PresetModule } from "./types";

interface QOParticle{x:number;y:number;size:number;alpha:number;phase:number;speed:number;hue:number}
interface QOWaveRing{phase:number;speed:number;radius:number;width:number;alpha:number;hue:number}

const PARTICLE_COUNT=200,WAVE_RING_COUNT=8
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const sst=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t

function makeParticle():QOParticle{return{x:ra(-1,1),y:ra(-1,1),size:ra(2,6),alpha:ra(0.4,1),phase:ra(0,Math.PI*2),speed:ra(0.003,0.015),hue:ri(200,280)}}

export const preset:PresetModule={
  definition:{id:"quantum-ocean",name:"量子海洋",icon:"🌊",description:"波函数干涉与概率云"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const particles:QOParticle[]=[]
    for(let i=0;i<PARTICLE_COUNT;i++)particles.push(makeParticle())

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

      // 背景
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.7)
      bg.addColorStop(0,"rgba(5,5,20,1)");bg.addColorStop(0.5,"rgba(8,8,30,1)");bg.addColorStop(1,"rgba(3,3,15,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // ─── 全屏波场（频率响应波纹面） ───
      const waveIntensity=0.3+avgE*0.4+bass*0.3
      for(let r=0;r<6;r++){
        const freqMul=1+r*0.6,phase=frame*0.008*(0.5+r*0.12)
        const rAlpha=(0.05+avgE*0.06+bass*0.03)*(1-r*0.1)
        if(rAlpha<0.003)continue
        for(let i=0;i<60;i++){
          const t=i/60,angle=t*Math.PI*2
          const dist=SS*(0.05+t*0.45)
          const wave=Math.sin(dist*freqMul*0.006+phase+r*1.5)*(0.08+bass*0.12)*SS
          const px=CX+Math.cos(angle)*(dist+wave)
          const py=CY+Math.sin(angle)*(dist+wave*0.6)
          const hue=220+r*15+Math.sin(frame*0.008+r)*15
          const dotA=rAlpha*(0.4+Math.sin(dist*0.008+phase)*0.5)
          const dotR=1.5+rAlpha*6
          const glowR=dotR*3
          ctx.beginPath();ctx.arc(px,py,Math.max(0.5,dotR),0,Math.PI*2)
          ctx.fillStyle=`hsla(${hue},70%,60%,${dotA})`
          ctx.fill()
          // 辉光
          const gg=ctx.createRadialGradient(px,py,0,px,py,glowR)
          gg.addColorStop(0,`hsla(${hue},60%,55%,${dotA*0.2})`)
          gg.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=gg;ctx.beginPath();ctx.arc(px,py,glowR,0,Math.PI*2);ctx.fill()
        }
      }

      // ─── 中心量子涡旋 ───
      const swirlA=0.1+avgE*0.15+bass*0.1
      if(swirlA>0.01){
        for(let si=0;si<80;si++){
          const st=si/80
          const angle=st*Math.PI*6+frame*0.01
          const dist=st*SS*0.4
          const sx=CX+Math.cos(angle)*dist,sy=CY+Math.sin(angle)*dist
          const sa=swirlA*(1-st)*(0.3+Math.sin(st*20+frame*0.05)*0.3)
          ctx.beginPath();ctx.arc(sx,sy,1.5+st*4,0,Math.PI*2)
          ctx.fillStyle=`hsla(${250+st*40},70%,${50+st*20}%,${sa})`
          ctx.fill()
        }
      }

      // ─── 粒子概率云（增强版） ───
      for(const p of particles){
        p.phase+=p.speed*(0.5+bass+mid*0.5)
        const waveX=Math.sin(p.phase)*0.3+Math.sin(p.phase*0.7+1)*0.2+Math.sin(p.phase*0.3+2)*0.15
        const waveY=Math.cos(p.phase*0.8)*0.3+Math.cos(p.phase*0.5+1.5)*0.2+Math.sin(p.phase*0.4+3)*0.15
        const px=CX+(p.x+waveX)*SS*0.35
        const py=CY+(p.y+waveY)*SS*0.35
        const sizePulse=0.5+Math.sin(p.phase*2)*0.5
        const sz=p.size*(0.5+sizePulse*0.5)*(0.5+avgE*0.5)
        const alpha=p.alpha*(0.5+avgE*0.5)*(0.5+sizePulse*0.5)
        if(alpha<0.02)continue
        ctx.beginPath();ctx.arc(px,py,Math.max(0.5,sz),0,Math.PI*2)
        const hue=p.hue+sizePulse*30
        ctx.fillStyle=`hsla(${hue},80%,${60+sizePulse*20}%,${alpha})`
        ctx.fill()
        // 辉光（扩大）
        const pg=ctx.createRadialGradient(px,py,0,px,py,sz*4)
        pg.addColorStop(0,`hsla(${hue+10},70%,60%,${alpha*0.3})`)
        pg.addColorStop(1,"hsla(0,0%,0%,0)")
        ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,sz*4,0,Math.PI*2);ctx.fill()
      }

      // ─── 连接线（密度翻倍、更亮） ───
      for(let i=0;i<particles.length;i+=2){
        const p1=particles[i]
        const p1x=CX+(p1.x+Math.sin(p1.phase)*0.3)*SS*0.35
        const p1y=CY+(p1.y+Math.cos(p1.phase*0.8)*0.3)*SS*0.35
        for(let j=i+1;j<particles.length;j+=4){
          const p2=particles[j]
          const dx=(p1.x+Math.sin(p1.phase)*0.3)-(p2.x+Math.sin(p2.phase)*0.3)
          const dy=(p1.y+Math.cos(p1.phase*0.8)*0.3)-(p2.y+Math.cos(p2.phase*0.8)*0.3)
          const dist2=Math.sqrt(dx*dx+dy*dy)
          if(dist2>0.5)continue
          const lineA=(1-dist2/0.5)*0.15*(0.5+avgE)
          ctx.beginPath();ctx.moveTo(p1x,p1y)
          ctx.lineTo(CX+(p2.x+Math.sin(p2.phase)*0.3)*SS*0.35,CY+(p2.y+Math.cos(p2.phase*0.8)*0.3)*SS*0.35)
          ctx.strokeStyle=`hsla(240,60%,65%,${lineA})`
          ctx.lineWidth=0.8+avgE;ctx.stroke()
        }
      }

      // --- 能量柱 ---
      if(analyser&&playing&&freq.length>0){
        const step=Math.max(1,Math.floor(freq.length/48)),maxH=H*0.05,bw=3,gap=1,tw=48*(bw+gap),startsx=(W-tw)/2
        for(let i=0;i<48;i++){let s=0;const st=i*step,en=Math.min(st+step,freq.length);for(let j=st;j<en;j++)s+=freq[j];const n=s/(en-st)/255,bh=Math.max(1,n*maxH),x=startsx+i*(bw+gap),y=H-bh;ctx.fillStyle=`hsla(${220+n*80},70%,${40+n*30}%,${0.08+n*0.12})`;ctx.fillRect(x,y,bw,bh)}
      }
    }
    draw()
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize)}
  },
}

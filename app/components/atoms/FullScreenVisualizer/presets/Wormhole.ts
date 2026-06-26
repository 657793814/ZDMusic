// 🌀 WORMHOLE TRANSIT — 虫洞穿梭 (v2)
// 第一人称虫洞隧道穿行：同心环 + 径向光流飞掠 + 脉冲出口
import type { PresetModule } from "./types";

interface TunnelRing {
  radius:number;width:number;hue:number;light:number;alpha:number;phase:number;
}
interface LightStreak {
  angle:number;length:number;speed:number;hue:number;bright:number;size:number;offset:number;
}
interface RushParticle {
  angle:number;progress:number;speed:number;size:number;hue:number;bright:number;zOffset:number;
}

const RINGS=35,STREAKS=120,RUSHERS=300
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))

function makeRing(i:number):TunnelRing{
  const t=i/RINGS
  return{
    radius:0.02+t*0.9,width:ra(0.005,0.025),
    hue:ri(220,280)+(i%3===0?40:0),light:ri(40,70),
    alpha:ra(0.08,0.28)*(1-t*0.4),phase:ra(0,Math.PI*2),
  }
}
function makeStreak():LightStreak{
  return{
    angle:ra(0,Math.PI*2),length:ra(0.4,0.9),speed:ra(0.003,0.015),
    hue:ri(200,290),bright:ra(0.2,0.7),size:ra(1,3.5),offset:ra(0,Math.PI*2),
  }
}
function makeRusher():RushParticle{
  return{
    angle:ra(0,Math.PI*2),progress:Math.random(),speed:ra(0.004,0.02),
    size:ra(0.5,2.5),hue:ri(190,300),bright:ra(0.2,0.8),zOffset:ra(-0.3,0.3),
  }
}

export const preset:PresetModule={
  definition:{id:"wormhole",name:"虫洞穿梭",icon:"🌀",description:"时空隧道内部视角"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const rings=Array.from({length:RINGS},(_,i)=>makeRing(i))
    const streaks=Array.from({length:STREAKS},()=>makeStreak())
    const rushers=Array.from({length:RUSHERS},()=>makeRusher())

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0,tunnelRot=0,pulse=0

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
      const maxR=Math.max(W,H)*0.5
      const speedMul=1+bass*2.5

      if(analyser&&playing){
        analyser.getByteFrequencyData(freq);const L=freq.length;let sum=0;for(let i=0;i<L;i++)sum+=freq[i]
        avgE=avgE*0.85+(sum/L/255)*0.15;const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4;const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}

      tunnelRot+=0.006*speedMul
      pulse=0.1+bass*0.35+avgE*0.15+0.05*Math.sin(frame*0.05)

      // ─── 背景 ───
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.7)
      bg.addColorStop(0,"rgba(2,1,8,1)");bg.addColorStop(0.3,"rgba(5,3,15,1)")
      bg.addColorStop(0.6,"rgba(10,6,22,1)");bg.addColorStop(1,"rgba(4,2,10,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // ─── 隧道 ───
      ctx.save();ctx.translate(CX,CY)

      // — 隧道壁底色 —
      const tb=ctx.createRadialGradient(0,0,0,0,0,maxR)
      tb.addColorStop(0,"rgba(40,25,70,0.08)")
      tb.addColorStop(0.3,`rgba(30,18,60,${0.06+avgE*0.06})`)
      tb.addColorStop(0.6,`rgba(20,12,45,${0.05+avgE*0.05})`)
      tb.addColorStop(0.9,`rgba(10,5,25,${0.04+avgE*0.04})`)
      tb.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=tb;ctx.beginPath();ctx.arc(0,0,maxR,0,Math.PI*2);ctx.fill()

      // — 同心环（透视隧道） —
      for(const r of rings){
        // 透视：越靠中心越小，旋转越快
        const depthFactor=1-r.radius
        const rr=r.radius*maxR
        const rA=r.alpha*(0.2+0.8*avgE)*depthFactor
        if(rA<0.003)continue
        const rotOff=tunnelRot*(1-r.radius*0.5)
        const wobble=r.radius*0.04*Math.sin(frame*0.02+r.phase)
        const segs=Math.max(12,Math.floor(60*depthFactor+20))
        const rw=r.width*maxR
        for(let si=0;si<segs;si++){
          const a0=(si/segs)*Math.PI*2+rotOff,a1=((si+1)/segs)*Math.PI*2+rotOff
          const pulse2=0.6+0.4*Math.sin(a0*5+frame*0.04+r.phase)
          const segA=rA*(0.5+pulse2*0.5)*(0.5+0.5*Math.sin(frame*0.03+r.phase))
          const wa0=a0+wobble*Math.cos(a0*2),wa1=a1+wobble*Math.cos(a1*2)
          const c=Math.cos,r0=rr-rw/2,r1=rr+rw/2
          ctx.beginPath()
          ctx.moveTo(c(wa0)*r0,Math.sin(wa0)*r0)
          ctx.lineTo(c(wa1)*r0,Math.sin(wa1)*r0)
          ctx.lineTo(c(wa1)*r1,Math.sin(wa1)*r1)
          ctx.lineTo(c(wa0)*r1,Math.sin(wa0)*r1)
          ctx.closePath()
          ctx.fillStyle=`hsla(${r.hue+si*0.3},60%,${r.light+10*Math.sin(si*0.15)}%,${segA})`
          ctx.fill()
        }
      }

      // — 光流（径向线条，从中心向边缘飞掠） —
      for(const st of streaks){
        st.angle+=st.speed*speedMul
        const sa=st.angle+st.offset
        const baseLen=st.length*maxR*0.4
        const len=baseLen*(0.3+0.7*avgE)*(1+bass*0.3)
        // 线条从半径 startR 延伸到 endR
        const startR=maxR*0.05,endR=startR+len
        const sA=st.bright*(0.15+0.85*avgE)*(0.4+0.6*(1+Math.sin(sa*3+frame*0.05))*0.5)
        if(sA<0.01)continue
        const sw=st.size*(0.3+avgE*0.5)
        // 渐变透明：尾端更透明
        for(let li=0;li<10;li++){
          const lt=li/10,rr2=startR+(endR-startR)*lt
          const rx=Math.cos(sa)*rr2,ry=Math.sin(sa)*rr2
          const dotA=sA*(1-lt*0.7)
          ctx.beginPath();ctx.arc(rx,ry,Math.max(0.2,sw*(1-lt*0.3)),0,Math.PI*2)
          ctx.fillStyle=`hsla(${st.hue+lt*10},70%,${55+20*avgE}%,${dotA})`
          ctx.fill()
        }
        // 拖尾连线
        const tx1=Math.cos(sa)*startR,ty1=Math.sin(sa)*startR
        const tx2=Math.cos(sa)*endR,ty2=Math.sin(sa)*endR
        ctx.beginPath();ctx.moveTo(tx1,ty1);ctx.lineTo(tx2,ty2)
        ctx.strokeStyle=`hsla(${st.hue},60%,60%,${sA*0.3})`
        ctx.lineWidth=Math.max(0.3,sw*0.5);ctx.stroke()
      }

      // — 飞掠粒子（从中心冲向边缘） —
      for(const p of rushers){
        p.progress+=p.speed*speedMul*(1+p.zOffset*0.5)
        if(p.progress>1){
          p.progress=0;p.angle=ra(0,Math.PI*2);p.speed=ra(0.005,0.025)
          p.size=ra(0.5,3);p.hue=ri(190,300);p.bright=ra(0.3,0.9);p.zOffset=ra(-0.3,0.3)
        }
        const pr=p.progress*maxR
        const px=Math.cos(p.angle)*pr,py=Math.sin(p.angle)*pr
        const pA=p.bright*(0.2+0.8*avgE)*Math.sin(p.progress*Math.PI)
        if(pA<0.01)continue
        const pz=p.size*(0.3+avgE*0.5)*(0.5+0.5*(1-p.progress))
        // glow
        const pg=ctx.createRadialGradient(px,py,0,px,py,pz*4)
        pg.addColorStop(0,`hsla(${p.hue},70%,60%,${pA*0.15})`)
        pg.addColorStop(1,"hsla(0,0%,0%,0)")
        ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,pz*4,0,Math.PI*2);ctx.fill()
        // core
        ctx.beginPath();ctx.arc(px,py,Math.max(0.3,pz),0,Math.PI*2)
        ctx.fillStyle=`hsla(${p.hue},80%,${60+20*avgE}%,${pA})`;ctx.fill()
      }

      // — 中心出口 —  
      const exitR=SS*(0.04+pulse*0.04)
      const eg=ctx.createRadialGradient(0,0,0,0,0,exitR*6)
      eg.addColorStop(0,`rgba(255,250,240,${Math.min(1,pulse*0.8)})`)
      eg.addColorStop(0.1,`hsla(280,70%,75%,${pulse*0.5})`)
      eg.addColorStop(0.25,`hsla(240,60%,60%,${pulse*0.25})`)
      eg.addColorStop(0.5,`hsla(210,50%,45%,${pulse*0.1})`)
      eg.addColorStop(0.8,`hsla(180,40%,30%,${pulse*0.04})`)
      eg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=eg;ctx.beginPath();ctx.arc(0,0,exitR*6,0,Math.PI*2);ctx.fill()
      // 内核小白点
      ctx.beginPath();ctx.arc(0,0,Math.max(1,exitR*0.6),0,Math.PI*2)
      ctx.fillStyle=`rgba(255,255,255,${Math.min(1,pulse*1.2)})`;ctx.fill()

      ctx.restore()

      // --- 能量柱 ---
      if(analyser&&playing&&freq.length>0){
        const step=Math.max(1,Math.floor(freq.length/48)),maxH=H*0.05,bw=3,gap=1,tw=48*(bw+gap),startsx=(W-tw)/2
        for(let i=0;i<48;i++){let s=0;const st=i*step,en=Math.min(st+step,freq.length);for(let j=st;j<en;j++)s+=freq[j];const n=s/(en-st)/255,bh=Math.max(1,n*maxH),x=startsx+i*(bw+gap),y=H-bh;ctx.fillStyle=`hsla(${230-n*60},70%,${40+n*30}%,${0.08+n*0.12})`;ctx.fillRect(x,y,bw,bh)}
      }
    }
    draw()
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize)}
  },
}

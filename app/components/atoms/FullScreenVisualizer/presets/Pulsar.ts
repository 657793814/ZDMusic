// ⚡ PULSAR — 脉冲星
import type { PresetModule } from "./types";

interface PSStar{x:number;y:number;z:number;size:number;hue:number;twP:number;twS:number}
interface PSWave{angle:number;life:number;maxRadius:number;speed:number;hue:number}
const STAR_COUNT=500,WAVE_COUNT=5
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const sst=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)}
function makeStar():PSStar{return{x:ra(-1.5,1.5),y:ra(-1.5,1.5),z:ra(0.5,8),size:ra(0.03,0.2),hue:ra(200,350),twP:ra(0,Math.PI*2),twS:ra(0.3,2)}}

export const preset:PresetModule={
  definition:{id:"pulsar",name:"脉冲星",icon:"⚡",description:"旋转脉冲心跳"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const stars:PSStar[]=[],waves:PSWave[]=[]
    for(let i=0;i<STAR_COUNT;i++)stars.push(makeStar())
    for(let i=0;i<WAVE_COUNT;i++)waves.push({angle:ra(0,Math.PI*2),life:1+i*0.15,maxRadius:ra(0.3,0.6),speed:ra(0.003,0.007),hue:ra(180,260)})

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0,pulseAngle=0,pulsePhase=0

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

      pulseAngle+=0.015+mid*0.06
      pulsePhase+=0.008+bass*0.04

      // 背景
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.6)
      bg.addColorStop(0,"rgba(5,3,12,1)");bg.addColorStop(0.4,"rgba(10,5,20,1)");bg.addColorStop(1,"rgba(3,2,8,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // 星云辉光
      const ng=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.4)
      ng.addColorStop(0,`rgba(130,80,180,${0.02+avgE*0.03})`)
      ng.addColorStop(0.5,`rgba(80,100,160,${0.01+avgE*0.02})`)
      ng.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=ng;ctx.beginPath();ctx.arc(CX,CY,SS*0.4,0,Math.PI*2);ctx.fill()

      // 星场
      for(const s of stars){
        s.z-=0.004*(1+mid*0.3);s.twP+=0.04*s.twS*(0.3+avgE)
        if(s.z<=0.3){Object.assign(s,makeStar());continue}
        const sx=CX+(s.x/s.z)*W*0.5,sy=CY+(s.y/s.z)*H*0.4
        if(sx<-20||sx>W+20||sy<-20||sy>H+20){Object.assign(s,makeStar());continue}
        const sz2=Math.min(2,s.size*(1/Math.max(0.2,s.z))*0.004*SS),db=Math.min(1,(6-s.z)/6*2),tw=0.5+Math.sin(s.twP)*0.5
        if(sz2>0.15){ctx.beginPath();ctx.arc(sx,sy,sz2*0.5,0,Math.PI*2);ctx.fillStyle=`hsla(${s.hue},40%,${45+db*25}%,${db*0.3*tw})`;ctx.fill()}
      }

      // 脉冲光束
      const beamBright=0.1+bass*0.4+avgE*0.1
      const beamLength=SS*0.7
      for(let bi=0;bi<2;bi++){
        const beamAngle=pulseAngle+bi*Math.PI
        const bx=CX+Math.cos(beamAngle)*beamLength
        const by=CY+Math.sin(beamAngle)*beamLength
        const bg2=ctx.createRadialGradient(CX,CY,0,CX,CY,beamLength)
        bg2.addColorStop(0,`hsla(${260+bi*40},80%,80%,${beamBright*0.5})`)
        bg2.addColorStop(0.1,`hsla(${250+bi*40},70%,70%,${beamBright*0.3})`)
        bg2.addColorStop(0.3,`hsla(${240+bi*40},60%,60%,${beamBright*0.1})`)
        bg2.addColorStop(1,"hsla(0,0%,0%,0)")
        ctx.fillStyle=bg2;ctx.save();ctx.translate(CX,CY);ctx.rotate(beamAngle)
        ctx.beginPath();ctx.rect(0,-beamLength*0.006,beamLength,beamLength*0.012)
        ctx.fill();ctx.restore()

        for(let ei=0;ei<3;ei++){
          const eOff=ei*SS*0.015
          const eg=ctx.createRadialGradient(bx+eOff,by,0,bx+eOff,by,beamLength*0.04*(1-ei*0.2))
          eg.addColorStop(0,`hsla(${270+bi*30},80%,80%,${beamBright*0.08*(1-ei*0.3)})`)
          eg.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=eg;ctx.beginPath();ctx.arc(bx+eOff,by,beamLength*0.04*(1-ei*0.2),0,Math.PI*2);ctx.fill()
        }
      }

      // 辐射波纹
      for(const w of waves){
        w.life+=w.speed*(1+bass)
        if(w.life>1.5){w.life=0;w.angle=ra(0,Math.PI*2);w.maxRadius=ra(0.3,0.6);w.hue=ra(180,260)}
        const wr=w.life*SS*0.3
        const wAlpha=(1-w.life/1.5)*0.1*(1+avgE)
        if(wAlpha<0.005)continue
        ctx.save();ctx.translate(CX,CY);ctx.rotate(w.angle)
        ctx.scale(1,0.5)
        for(let ri2=0;ri2<2;ri2++){
          const r=wr+ri2*8
          const wa=wAlpha*(1-ri2*0.3)
          ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2)
          ctx.strokeStyle=`hsla(${w.hue+ri2*10},70%,70%,${wa})`
          ctx.lineWidth=1.5-ri2*0.5;ctx.stroke()
        }
        ctx.restore()
      }

      // 核心中子星
      const corePulse=0.5+Math.sin(pulsePhase*3)*0.5
      const coreA=0.3+corePulse*0.4+bass*0.2
      const coreR=SS*0.02*(1+corePulse*0.3+bass*0.2)
      const cg=ctx.createRadialGradient(CX,CY,0,CX,CY,coreR*3)
      cg.addColorStop(0,`rgba(255,255,255,${coreA})`)
      cg.addColorStop(0.15,`hsla(240,70%,80%,${coreA*0.8})`)
      cg.addColorStop(0.4,`hsla(220,60%,60%,${coreA*0.3})`)
      cg.addColorStop(0.7,`hsla(200,50%,40%,${coreA*0.1})`)
      cg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(CX,CY,coreR*3,0,Math.PI*2);ctx.fill()
      ctx.beginPath();ctx.arc(CX,CY,coreR,0,Math.PI*2)
      ctx.fillStyle=`rgba(255,255,255,${coreA*0.8})`
      ctx.fill()

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

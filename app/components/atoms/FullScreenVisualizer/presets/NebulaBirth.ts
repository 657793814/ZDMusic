// 🫧 NEBULA BIRTH — 星云孕育 (v2)
import type { PresetModule } from "./types";

interface NBGasmass {
  x:number;y:number;size:number;hue:number;alpha:number;
  vx:number;vy:number;phase:number;pulseSpeed:number;
}
interface NBStream {
  angle:number;progress:number;speed:number;width:number;hue:number;bright:number;
}
interface NBDustPart {
  angle:number;radius:number;size:number;bright:number;speed:number;
}
interface NBInfall {
  angle:number;progress:number;speed:number;size:number;hue:number;bright:number;
}

const GAS=40,STREAMS=12,DUST=400,INFALL=25
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))

function makeGas():NBGasmass{
  const a=ra(0,Math.PI*2),r=ra(0.1,0.95)
  return{
    x:Math.cos(a)*r,y:Math.sin(a)*r*0.6,size:ra(0.15,0.55),
    hue:ri(200,340),alpha:ra(0.08,0.25),vx:-r*ra(0.0003,0.002),
    vy:ra(-0.0005,0.0005),phase:ra(0,Math.PI*2),pulseSpeed:ra(0.02,0.06),
  }
}
function makeStream():NBStream{
  return{angle:ra(0,Math.PI*2),progress:ra(0,0.5),speed:ra(0.003,0.008),
    width:ra(0.015,0.04),hue:ri(220,300),bright:ra(0.3,0.7)}
}
function makeDust():NBDustPart{
  return{angle:ra(0,Math.PI*2),radius:ra(0.05,0.7),size:ra(0.3,1.5),
    bright:ra(0.15,0.5),speed:ra(0.001,0.006)}
}
function makeInfall():NBInfall{
  return{angle:ra(0,Math.PI*2),progress:Math.random()*0.5,
    speed:ra(0.005,0.015),size:ra(1,3.5),hue:ri(200,300),bright:ra(0.3,0.8)}
}

export const preset:PresetModule={
  definition:{id:"nebula-birth",name:"星云孕育",icon:"🫧",description:"原恒星凝聚诞生"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const gasLumps=Array.from({length:GAS},()=>makeGas())
    const streams=Array.from({length:STREAMS},()=>makeStream())
    const dustParts=Array.from({length:DUST},()=>makeDust())
    const infalls=Array.from({length:INFALL},()=>makeInfall())

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0,flash=0

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

      // bass beat → flash
      if(bass>0.35&&bass>avgE*1.4)flash=Math.min(1,flash+bass*1.2)
      flash*=0.9

      // 背景
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.8)
      bg.addColorStop(0,"rgba(12,4,20,1)");bg.addColorStop(0.3,"rgba(18,8,28,1)")
      bg.addColorStop(0.6,"rgba(10,5,18,1)");bg.addColorStop(1,"rgba(4,2,8,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // ── 气体云 — 向中心坍缩 ──
      for(const g of gasLumps){
        const d=Math.sqrt(g.x*g.x+g.y*g.y)
        if(d>0.02){
          const force=d*0.0004*(1+bass)
          g.x-=g.x*force;g.y-=g.y*force
        }else{
          const a=ra(0,Math.PI*2),r=ra(0.5,0.9)
          g.x=Math.cos(a)*r;g.y=Math.sin(a)*r*0.6
        }
        g.x+=Math.sin(g.phase+frame*g.pulseSpeed)*0.0004
        g.y+=Math.cos(g.phase*1.3+frame*g.pulseSpeed*0.7)*0.0004

        const gx=CX+g.x*SS*0.45,gy=CY+g.y*SS*0.45
        const gs=g.size*SS*0.5*(1+bass*0.15)
        const pulse=0.6+0.4*Math.sin(frame*g.pulseSpeed+g.phase)
        const gA=g.alpha*(0.3+0.7*avgE)*pulse
        if(gA<0.005)continue
        const gg=ctx.createRadialGradient(gx,gy,0,gx,gy,gs)
        gg.addColorStop(0,`hsla(${g.hue},60%,55%,${gA})`)
        gg.addColorStop(0.5,`hsla(${g.hue+15},50%,40%,${gA*0.5})`)
        gg.addColorStop(1,"hsla(0,0%,0%,0)")
        ctx.fillStyle=gg;ctx.beginPath();ctx.arc(gx,gy,gs,0,Math.PI*2);ctx.fill()
      }

      // ── 吸积流 — 物质从外缘流向中心 ──
      for(const s of streams){
        s.progress+=s.speed*(1+bass*2.5)
        if(s.progress>1){s.progress=0;s.angle=ra(0,Math.PI*2);s.speed=ra(0.003,0.01)}
        const maxR=SS*0.38,curR=maxR*(1-s.progress)
        const sx=CX+Math.cos(s.angle)*curR,sy=CY+Math.sin(s.angle)*curR*0.5
        const dotA=s.bright*(0.4+0.6*avgE)*(0.5+0.5*flash)
        const dotS=Math.max(1,s.width*SS*0.08*(1+bass))
        // head glow
        const sg=ctx.createRadialGradient(sx,sy,0,sx,sy,dotS*4)
        sg.addColorStop(0,`hsla(${s.hue},70%,60%,${dotA*0.3})`)
        sg.addColorStop(1,"hsla(0,0%,0%,0)")
        ctx.fillStyle=sg;ctx.beginPath();ctx.arc(sx,sy,dotS*4,0,Math.PI*2);ctx.fill()
        // head dot
        ctx.beginPath();ctx.arc(sx,sy,dotS,0,Math.PI*2)
        ctx.fillStyle=`hsla(${s.hue},80%,65%,${dotA})`;ctx.fill()
        // tail line
        ctx.beginPath()
        ctx.moveTo(CX+Math.cos(s.angle)*maxR,CY+Math.sin(s.angle)*maxR*0.5)
        ctx.lineTo(sx,sy)
        ctx.strokeStyle=`hsla(${s.hue},60%,50%,${dotA*0.25})`
        ctx.lineWidth=Math.max(0.5,s.width*SS*0.04);ctx.stroke()
      }

      // ── 坠入粒子 — 细小光点冲向中心 ──
      for(const inf of infalls){
        inf.progress+=inf.speed*(1+bass*2)
        if(inf.progress>1){inf.progress=0;inf.angle=ra(0,Math.PI*2);inf.speed=ra(0.005,0.016)}
        const maxR=SS*0.35,r2=maxR*(1-inf.progress)
        const ix=CX+Math.cos(inf.angle)*r2,iy=CY+Math.sin(inf.angle)*r2*0.5
        const iA=inf.bright*(0.3+0.7*avgE)*Math.sin(inf.progress*Math.PI)
        if(iA<0.01)continue
        const iz=inf.size*(0.3+avgE*0.6)*(0.3+0.7*(1-inf.progress))
        ctx.beginPath();ctx.arc(ix,iy,iz,0,Math.PI*2)
        ctx.fillStyle=`hsla(${inf.hue},70%,${55+20*avgE}%,${iA})`;ctx.fill()
      }

      // ── 吸积盘（尘埃环） ──
      ctx.save();ctx.translate(CX,CY);ctx.scale(1.3,0.5)
      const rot=frame*0.004*(1+bass*0.5)
      for(let ring=0;ring<3;ring++){
        const ringR=SS*(0.06+ring*0.065+bass*0.012),hue=250+ring*15,off=ring*2.1
        for(let i=0;i<70;i++){
          const t=i/70,a=t*Math.PI*2+rot+off
          const pulse=0.4+0.6*Math.sin(a*6+off)
          const dA=(0.025+avgE*0.05+bass*0.025)*pulse*(1-ring*0.2)
          if(dA<0.003)continue
          const wr=ringR*(1+0.03*Math.sin(a*3+off))
          ctx.beginPath()
          ctx.moveTo(Math.cos(a)*wr,Math.sin(a)*wr)
          ctx.arc(0,0,wr,a,a+0.12)
          ctx.strokeStyle=`hsla(${hue},50%,${35+25*avgE}%,${dA})`
          ctx.lineWidth=Math.max(0.3,SS*0.003*(1+bass));ctx.stroke()
        }
      }
      ctx.restore()

      // ── 尘埃粒子 ──
      for(const d of dustParts){
        d.angle+=d.speed*(1+bass*0.8)
        const dr=d.radius*SS*0.45*(1-bass*0.05)
        const dx=CX+Math.cos(d.angle+frame*0.005*(1+bass))*dr
        const dy=CY+Math.sin(d.angle+frame*0.005*(1+bass))*dr*0.45
        const dA=d.bright*(0.2+avgE*0.4)
        if(dA<0.003)continue
        const sz=d.size*(0.3+avgE*0.6)
        ctx.beginPath();ctx.arc(dx,dy,Math.max(0.2,sz),0,Math.PI*2)
        ctx.fillStyle=`hsla(${270+d.bright*50},50%,${45+avgE*20}%,${dA})`;ctx.fill()
      }

      // ── 核心原恒星 ──
      const coreA=0.15+flash*0.6+avgE*0.3+bass*0.25
      const coreR=SS*(0.015+bass*0.015+avgE*0.01+flash*0.02)
      const outerR=coreR*(4+flash*3)
      const cg=ctx.createRadialGradient(CX,CY,0,CX,CY,outerR)
      cg.addColorStop(0,`rgba(255,240,220,${Math.min(1,coreA)})`)
      cg.addColorStop(0.15,`hsla(40,90%,75%,${coreA*0.7})`)
      cg.addColorStop(0.4,`hsla(25,80%,55%,${coreA*0.3})`)
      cg.addColorStop(0.7,`hsla(330,70%,40%,${coreA*0.1})`)
      cg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(CX,CY,outerR,0,Math.PI*2);ctx.fill()
      // 内核
      ctx.beginPath();ctx.arc(CX,CY,Math.max(1,coreR*0.8),0,Math.PI*2)
      ctx.fillStyle=`rgba(255,250,240,${Math.min(1,coreA*1.2)})`;ctx.fill()

      // ── 闪焰光晕（bass 闪爆时） ──
      if(flash>0.1){
        for(let i=0;i<6;i++){
          const fa=(i/6)*Math.PI*2+frame*0.01
          const fl=coreR*6*flash*(0.5+0.5*Math.sin(i*1.7))
          ctx.beginPath();ctx.moveTo(CX,CY)
          ctx.quadraticCurveTo(CX+Math.cos(fa-0.1)*fl,CY+Math.sin(fa-0.1)*fl*0.5,
            CX+Math.cos(fa)*fl*1.2,CY+Math.sin(fa)*fl*1.2*0.5)
          ctx.quadraticCurveTo(CX+Math.cos(fa+0.1)*fl,CY+Math.sin(fa+0.1)*fl*0.5,CX,CY)
          ctx.fillStyle=`hsla(40,80%,70%,${flash*0.15})`;ctx.fill()
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

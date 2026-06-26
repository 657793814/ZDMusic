// 🫧 NEBULA BIRTH — 星云孕育
import type { PresetModule } from "./types";

interface NBGasmass{x:number;y:number;size:number;hue:number;alpha:number;driftX:number;driftY:number;phase:number}
interface NBFilament{startAngle:number;endAngle:number;length:number;width:number;hue:number;bright:number;phase:number}
interface NBDustPart{angle:number;radius:number;size:number;bright:number;speed:number}

const GAS_COUNT=30,FILAMENT_COUNT=25,DUST_COUNT=300
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))

function makeGas():NBGasmass{return{x:ra(-0.8,0.8),y:ra(-0.8,0.8),size:ra(0.15,0.4),hue:ri(200,330),alpha:ra(0.04,0.12),driftX:ra(-0.001,0.001),driftY:ra(-0.001,0.001),phase:ra(0,Math.PI*2)}}
function makeFilament():NBFilament{return{startAngle:ra(0,Math.PI*2),endAngle:ra(0,Math.PI*2),length:ra(0.1,0.4),width:ra(0.005,0.02),hue:ri(250,330),bright:ra(0.1,0.4),phase:ra(0,Math.PI*2)}}
function makeDust():NBDustPart{return{angle:ra(0,Math.PI*2),radius:ra(0.05,0.6),size:ra(0.3,1.5),bright:ra(0.1,0.5),speed:ra(0.002,0.008)}}

export const preset:PresetModule={
  definition:{id:"nebula-birth",name:"星云孕育",icon:"🫧",description:"原恒星凝聚诞生"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const gasMasses=Array.from({length:GAS_COUNT},()=>makeGas())
    const filaments=Array.from({length:FILAMENT_COUNT},()=>makeFilament())
    const dust=Array.from({length:DUST_COUNT},()=>makeDust())

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0,coreLife=0

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

      coreLife=Math.min(1,coreLife+0.002*(1+bass*3))

      // 背景
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.7)
      bg.addColorStop(0,"rgba(8,5,15,1)");bg.addColorStop(0.5,"rgba(12,8,20,1)");bg.addColorStop(1,"rgba(5,3,10,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // 背景星云气体
      for(const g of gasMasses){
        g.x+=g.driftX*(1+bass*0.5);g.y+=g.driftY*(1+mid*0.5)
        const gx=CX+g.x*SS*0.4,gy=CY+g.y*SS*0.4
        const gs=g.size*SS*0.5
        const gA=g.alpha*(0.5+avgE*0.5)
        if(gA<0.003)continue
        const gg=ctx.createRadialGradient(gx,gy,0,gx,gy,gs)
        gg.addColorStop(0,`hsla(${g.hue},50%,40%,${gA})`)
        gg.addColorStop(0.5,`hsla(${g.hue+10},40%,30%,${gA*0.5})`)
        gg.addColorStop(1,"hsla(0,0%,0%,0)")
        ctx.fillStyle=gg;ctx.beginPath();ctx.arc(gx,gy,gs,0,Math.PI*2);ctx.fill()
      }

      // 气体丝线向中心汇聚
      for(const f of filaments){
        f.phase+=0.01*(1+bass+mid*0.3)
        const spread=Math.min(SS*0.4,f.length*SS*(0.3+coreLife*0.5))
        const fA=f.bright*(0.1+avgE*0.3+mid*0.2)*(0.3+coreLife*0.5)
        if(fA<0.005)continue
        const segs=20
        ctx.beginPath()
        for(let si=0;si<=segs;si++){
          const st=si/segs
          const angle=f.startAngle+(f.endAngle-f.startAngle)*st
          const dist=spread*st
          const wobble=Math.sin(st*10+f.phase)*dist*0.05
          const px=CX+Math.cos(angle+wobble)*dist
          const py=CY+Math.sin(angle+wobble)*dist*0.6
          if(si===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)
        }
        ctx.strokeStyle=`hsla(${f.hue},60%,50%,${fA})`
        ctx.lineWidth=Math.max(0.5,f.width*SS*0.1);ctx.stroke()
      }

      // 尘埃盘
      ctx.save();ctx.translate(CX,CY)
      ctx.scale(1.2,0.5);ctx.rotate(frame*0.003*(1+bass))
      for(let ri2=0;ri2<2;ri2++){
        for(let i=0;i<60;i++){
          const t=i/60
          const angle=t*Math.PI*2
          const r=SS*(0.08+coreLife*0.15+ri2*0.06)
          const pulse=0.5+Math.sin(angle*6+frame*0.02+ri2)*0.5
          const dA=(0.02+avgE*0.04+bass*0.02)*(1-ri2*0.3)*pulse
          if(dA<0.005)continue
          ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r)
          ctx.fillStyle=`hsla(${260+ri2*20},40%,${30+coreLife*30}%,${dA})`
        }
      }
      ctx.restore()

      // 尘埃粒子
      for(const d of dust){
        d.angle+=d.speed*(1+bass+coreLife)
        const dr=d.radius*SS*(0.3+coreLife*0.3)
        const dx=CX+Math.cos(d.angle+frame*0.005*(1+bass))*dr
        const dy=CY+Math.sin(d.angle+frame*0.005*(1+bass))*dr*0.5
        const dA=d.bright*(0.1+avgE*0.3)*(0.3+coreLife*0.5)
        if(dA<0.005)continue
        const sz=d.size*(0.3+avgE*0.5)
        ctx.beginPath();ctx.arc(dx,dy,Math.max(0.2,sz),0,Math.PI*2)
        ctx.fillStyle=`hsla(${280+d.bright*40},50%,${40+coreLife*30}%,${dA})`
        ctx.fill()
      }

      // 核心原恒星
      const coreA=0.05+coreLife*(0.3+bass*0.4+avgE*0.2)
      const coreR=SS*(0.02+coreLife*0.04)*(1+bass*0.3)
      const cg=ctx.createRadialGradient(CX,CY,0,CX,CY,coreR*4)
      cg.addColorStop(0,`rgba(255,255,255,${coreA})`)
      cg.addColorStop(0.2,`hsla(40,80%,70%,${coreA*0.7})`)
      cg.addColorStop(0.5,`hsla(20,70%,50%,${coreA*0.3})`)
      cg.addColorStop(0.8,`hsla(330,60%,40%,${coreA*0.1})`)
      cg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(CX,CY,coreR*4,0,Math.PI*2);ctx.fill()
      ctx.beginPath();ctx.arc(CX,CY,Math.max(1,coreR),0,Math.PI*2)
      ctx.fillStyle=`rgba(255,240,200,${coreA})`
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

// ☀️ SOLAR STORM — 太阳风暴
import type { PresetModule } from "./types";

interface SSStar{x:number;y:number;z:number;size:number;hue:number}
interface SSParticle{angle:number;dist:number;speed:number;size:number;hue:number;alpha:number;life:number}
interface SSProminence{angle:number;height:number;speed:number;hue:number;width:number;phase:number}

const STAR_COUNT=300,PARTICLE_COUNT=200,PROM_COUNT=6
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const sst=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)}

function makeStar():SSStar{return{x:ra(-1.5,1.5),y:ra(-1.5,1.5),z:ra(0.5,8),size:ra(0.03,0.2),hue:ra(200,350)}}

export const preset:PresetModule={
  definition:{id:"solar-storm",name:"太阳风暴",icon:"☀️",description:"日冕物质抛射"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const stars:SSStar[]=[],particles:SSParticle[]=[],proms:SSProminence[]=[]
    for(let i=0;i<STAR_COUNT;i++)stars.push(makeStar())
    for(let i=0;i<PARTICLE_COUNT;i++)particles.push({angle:ra(0,Math.PI*2),dist:ra(0.1,0.8),speed:ra(0.002,0.008),size:ra(0.3,1.5),hue:ra(10,40),alpha:ra(0.2,0.8),life:ra(0,1)})
    for(let i=0;i<PROM_COUNT;i++)proms.push({angle:(i/PROM_COUNT)*Math.PI*2+ra(-0.1,0.1),height:ra(0.15,0.3),speed:ra(0.003,0.008),hue:ri(10,40),width:ra(0.05,0.12),phase:ra(0,Math.PI*2)})

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
      const sunR=SS*0.1+avgE*SS*0.02

      if(analyser&&playing){
        analyser.getByteFrequencyData(freq);const L=freq.length;let sum=0;for(let i=0;i<L;i++)sum+=freq[i]
        avgE=avgE*0.85+(sum/L/255)*0.15;const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4;const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}

      // 背景
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.7)
      bg.addColorStop(0,"rgba(5,3,8,1)");bg.addColorStop(0.5,"rgba(10,5,12,1)");bg.addColorStop(1,"rgba(3,2,6,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // 星场
      for(const s of stars){
        s.z-=0.003*(1+mid*0.3)
        if(s.z<=0.3){Object.assign(s,makeStar());continue}
        const sx=CX+(s.x/s.z)*W*0.5,sy=CY+(s.y/s.z)*H*0.4
        if(sx<-20||sx>W+20||sy<-20||sy>H+20){Object.assign(s,makeStar());continue}
        const sz2=Math.min(2,s.size*(1/Math.max(0.2,s.z))*0.004*SS),db=Math.min(1,(6-s.z)/6*2)
        if(sz2>0.15){ctx.beginPath();ctx.arc(sx,sy,sz2*0.5,0,Math.PI*2);ctx.fillStyle=`hsla(240,30%,${40+db*20}%,${db*0.2})`;ctx.fill()}
      }

      // 日冕
      const coronaA=0.08+avgE*0.1+bass*0.15
      const cg=ctx.createRadialGradient(CX,CY,sunR*0.5,CX,CY,sunR*3)
      cg.addColorStop(0,`rgba(255,200,100,${coronaA})`)
      cg.addColorStop(0.3,`rgba(255,150,60,${coronaA*0.6})`)
      cg.addColorStop(0.6,`rgba(200,80,40,${coronaA*0.2})`)
      cg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(CX,CY,sunR*3,0,Math.PI*2);ctx.fill()

      // 日珥
      for(const p of proms){
        p.height+=p.speed*(1+bass*2)*Math.sin(frame*0.02+p.phase)*0.15
        p.height=Math.max(0.05,Math.min(0.5,p.height))
        const ph=p.height*SS*0.5
        const pw=p.width*SS*0.15
        const segments=20
        for(let gi=0;gi<segments;gi++){
          const gt=gi/segments
          const gx=CX+Math.cos(p.angle)*sunR*0.8+Math.cos(p.angle+0.5)*ph*gt
          const gy=CY+Math.sin(p.angle)*sunR*0.8-Math.sin(p.angle+0.5)*ph*gt*0.5
          const gw=pw*(1-gt)*0.5*(0.5+Math.sin(frame*0.05+gi)*0.3)
          const ga=(1-gt)*0.2*(1+avgE+bass*0.5)
          if(ga<0.005)continue
          const gg=ctx.createRadialGradient(gx,gy,0,gx,gy,gw)
          gg.addColorStop(0,`hsla(${p.hue},100%,80%,${ga})`)
          gg.addColorStop(0.5,`hsla(${p.hue+5},90%,60%,${ga*0.5})`)
          gg.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=gg;ctx.beginPath();ctx.arc(gx,gy,gw,0,Math.PI*2);ctx.fill()
        }
      }

      // 表面沸腾
      const boilA=0.2+bass*0.3
      for(let i=0;i<60;i++){
        const ba=(i/60)*Math.PI*2+frame*0.005
        const br=sunR*ra(0.4,0.95)
        const bx=CX+Math.cos(ba+Math.sin(frame*0.02+i))*br
        const by=CY+Math.sin(ba+Math.cos(frame*0.03+i))*br
        const bSize=ra(2,8)*(1+bass*0.5)
        const bAlpha=boilA*ra(0.3,1)*(1-Math.abs(0.5-(br/sunR))*0.5)
        ctx.beginPath();ctx.arc(bx,by,bSize,0,Math.PI*2)
        ctx.fillStyle=`hsla(${ri(20,45)},100%,${60+ri(0,20)}%,${bAlpha})`
        ctx.fill()
      }

      // 太阳本体
      const sg=ctx.createRadialGradient(CX-sunR*0.2,CY-sunR*0.2,0,CX,CY,sunR)
      sg.addColorStop(0,`rgba(255,230,180,${0.8+avgE*0.1})`)
      sg.addColorStop(0.5,`rgba(255,180,80,${0.7+avgE*0.1})`)
      sg.addColorStop(0.8,`rgba(230,120,40,${0.6+avgE*0.1})`)
      sg.addColorStop(1,`rgba(180,60,20,${0.4+avgE*0.1})`)
      ctx.fillStyle=sg;ctx.beginPath();ctx.arc(CX,CY,sunR,0,Math.PI*2);ctx.fill()

      // 粒子流
      for(const pt of particles){
        pt.dist+=pt.speed*(1+bass+mid*0.5)
        pt.life-=0.002*(1+bass*0.3)
        if(pt.dist>0.9||pt.life<0){pt.angle=ra(0,Math.PI*2);pt.dist=ra(0.15,0.25);pt.speed=ra(0.002,0.008);pt.size=ra(0.3,1.5);pt.life=ra(0.5,1);continue}
        const px=CX+Math.cos(pt.angle)*pt.dist*SS*0.45
        const py=CY+Math.sin(pt.angle)*pt.dist*SS*0.45
        const ptA=pt.alpha*pt.life*(0.3+avgE*0.5)
        if(ptA<0.005)continue
        const ptSize=pt.size*(0.5+pt.dist*bass*0.5)
        ctx.beginPath();ctx.arc(px,py,Math.max(0.2,ptSize),0,Math.PI*2)
        ctx.fillStyle=`hsla(${pt.hue},100%,${60+pt.dist*30}%,${ptA})`
        ctx.fill()
        if(ptSize>0.8){
          const pg=ctx.createRadialGradient(px,py,0,px,py,ptSize*2.5)
          pg.addColorStop(0,`hsla(${pt.hue},100%,70%,${ptA*0.3})`)
          pg.addColorStop(1,"hsla(0,0%,0%,0)");ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,ptSize*2.5,0,Math.PI*2);ctx.fill()
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

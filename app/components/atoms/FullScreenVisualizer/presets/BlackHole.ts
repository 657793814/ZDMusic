// 🕳️ BLACK HOLE — 黑洞吸积（增强版）
import type { PresetModule } from "./types";

interface BHStar{x:number;y:number;z:number;size:number;hue:number;twP:number;twS:number}
interface BHParticle{angle:number;radius:number;size:number;bright:number;speed:number;life:number}
interface BHJetPoint{t:number;angle:number;size:number;bright:number;hue:number}

const STAR_COUNT=600,PARTICLE_COUNT=2000,JET_COUNT=60
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
function makeStar():BHStar{return{x:ra(-1.5,1.5),y:ra(-1.5,1.5),z:ra(0.5,8),size:ra(0.03,0.2),hue:ra(200,350),twP:ra(0,Math.PI*2),twS:ra(0.3,2)}}
function makeParticle():BHParticle{return{angle:ra(0,Math.PI*2),radius:ra(0.3,0.95),size:ra(0.5,3),bright:ra(0.2,0.8),speed:ra(0.002,0.006),life:ra(0.5,1)}}

export const preset:PresetModule={
  definition:{id:"black-hole",name:"黑洞吸积",icon:"🕳️",description:"视界与吸积盘"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const stars:BHStar[]=[],particles:BHParticle[]=[],jets:BHJetPoint[]=[]
    for(let i=0;i<STAR_COUNT;i++)stars.push(makeStar())
    for(let i=0;i<PARTICLE_COUNT;i++)particles.push(makeParticle())
    for(let i=0;i<JET_COUNT;i++)jets.push({t:i/JET_COUNT,angle:ra(0,Math.PI*2),size:ra(0.5,2.5),bright:ra(0.3,0.8),hue:ri(200,280)})

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0,diskRot=0

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

      diskRot+=0.005+bass*0.015

      // 背景深空
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.7)
      bg.addColorStop(0,"rgba(8,5,15,1)");bg.addColorStop(0.5,"rgba(12,8,20,1)");bg.addColorStop(1,"rgba(5,3,10,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // 星场
      for(const s of stars){
        s.z-=0.004*(1+mid*0.3);s.twP+=0.04*s.twS*(0.3+avgE)
        if(s.z<=0.3){Object.assign(s,makeStar());continue}
        const sx=CX+(s.x/s.z)*W*0.5,sy=CY+(s.y/s.z)*H*0.4
        if(sx<-20||sx>W+20||sy<-20||sy>H+20){Object.assign(s,makeStar());continue}
        const sz2=Math.min(2.5,s.size*(1/Math.max(0.2,s.z))*0.004*SS),db=Math.min(1,(6-s.z)/6*2),tw=0.5+Math.sin(s.twP)*0.5
        if(sz2>0.15){ctx.beginPath();ctx.arc(sx,sy,sz2*0.5,0,Math.PI*2);ctx.fillStyle=`hsla(${s.hue},30%,${45+db*20}%,${db*0.25*tw})`;ctx.fill()}
      }

      // 视界阴影（增大）
      const ehSize=SS*0.14
      const sh=ctx.createRadialGradient(CX,CY,0,CX,CY,ehSize*2.5)
      sh.addColorStop(0,"rgba(0,0,0,0.98)")
      sh.addColorStop(0.4,`rgba(0,0,0,${0.85+bass*0.1})`)
      sh.addColorStop(0.7,`rgba(5,0,10,${0.35+bass*0.1})`)
      sh.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=sh;ctx.beginPath();ctx.arc(CX,CY,ehSize*2.5,0,Math.PI*2);ctx.fill()

      // 吸积盘（增大）
      ctx.save();ctx.translate(CX,CY)
      ctx.rotate(0.3);ctx.scale(1,0.3);ctx.rotate(diskRot)
      const diskR=SS*0.5
      for(let i=0;i<120;i++){
        const t=i/120
        const angle=t*Math.PI*2
        const r=ehSize*0.5+t*diskR
        const pulse=0.5+Math.sin(angle*6+frame*0.02)*0.5
        const dA=(0.05+avgE*0.08+bass*0.05)*pulse*(1-t*0.35)
        if(dA<0.003)continue
        const hue=220+t*80+Math.sin(angle*3+frame*0.01)*20
        ctx.beginPath()
        ctx.moveTo(0,0)
        ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r)
        ctx.strokeStyle=`hsla(${hue},70%,${40+t*30+avgE*10}%,${dA})`
        ctx.lineWidth=1.5+t*4;ctx.stroke()
      }
      ctx.restore()

      // 吸积粒子（螺旋落向视界）
      for(const p of particles){
        p.angle+=p.speed*(1+bass+mid*0.3)
        p.radius-=0.001*(1+bass)
        p.life-=0.002*(1+bass*0.3)
        if(p.radius<0.08||p.life<0){Object.assign(p,makeParticle());continue}
        const pr=p.radius*SS*0.5
        const px=CX+Math.cos(p.angle+diskRot*(1-p.radius))*pr
        const py=CY+Math.sin(p.angle+diskRot*(1-p.radius))*pr*0.3
        const pA=p.bright*p.life*(0.3+avgE*0.4)*(1-p.radius)+bass*0.2
        if(pA<0.005)continue
        const sz=p.size*(0.3+avgE*0.5)*(1-p.radius*0.5)+0.5
        ctx.beginPath();ctx.arc(px,py,Math.max(0.3,sz),0,Math.PI*2)
        ctx.fillStyle=`hsla(${260-p.radius*60},70%,${50+avgE*20}%,${pA})`
        ctx.fill()
        if(sz>1){
          const pg=ctx.createRadialGradient(px,py,0,px,py,sz*4)
          pg.addColorStop(0,`hsla(${270-p.radius*50},60%,55%,${pA*0.25})`);pg.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,sz*4,0,Math.PI*2);ctx.fill()
        }
      }

      // 相对论喷流（更长更粗）
      for(const j of jets){
        j.t+=0.02*(1+bass*2+mid*0.5)
        if(j.t>1){j.t=0;j.angle=ra(-0.3,0.3);j.size=ra(0.5,2.5);j.bright=ra(0.3,0.8);j.hue=ri(200,280)}
        const jt=j.t
        const jDist=jt*SS*0.45
        const jx=CX+Math.sin(j.angle)*jDist
        const jy=CY-Math.cos(j.angle)*jDist
        const ja=j.bright*(1-jt*0.5)*(0.2+avgE*0.4+bass*0.25)
        if(ja<0.003)continue
        const jw=j.size*0.5+jt*j.size*(1.5+avgE)
        ctx.beginPath();ctx.arc(jx,jy,Math.max(0.5,jw),0,Math.PI*2)
        ctx.fillStyle=`hsla(${j.hue},70%,${60+jt*20}%,${ja})`
        ctx.fill()
        if(jw>1.5){
          const jg=ctx.createRadialGradient(jx,jy,0,jx,jy,jw*5)
          jg.addColorStop(0,`hsla(${j.hue+10},60%,65%,${ja*0.2})`);jg.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=jg;ctx.beginPath();ctx.arc(jx,jy,jw*5,0,Math.PI*2);ctx.fill()
        }
      }

      // 视界边缘辉光
      const ehGlow=0.15+bass*0.25+avgE*0.15
      const eg=ctx.createRadialGradient(CX,CY,ehSize*0.9,CX,CY,ehSize*1.8)
      eg.addColorStop(0,`hsla(240,70%,50%,${ehGlow*0.6})`)
      eg.addColorStop(0.5,`hsla(270,60%,55%,${ehGlow*0.3})`)
      eg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=eg;ctx.beginPath();ctx.arc(CX,CY,ehSize*1.8,0,Math.PI*2);ctx.fill()

      // 引力透镜畸变
      for(let i=0;i<12;i++){
        const a=(i/12)*Math.PI*2+diskRot*0.5
        const dist=ehSize*(1.6+Math.sin(frame*0.01+i)*0.25)
        const lx=CX+Math.cos(a)*dist,ly=CY+Math.sin(a)*dist
        const lg=ctx.createRadialGradient(lx,ly,0,lx,ly,dist*0.1)
        lg.addColorStop(0,`rgba(255,220,180,${0.03+bass*0.08})`);lg.addColorStop(1,"rgba(0,0,0,0)")
        ctx.fillStyle=lg;ctx.beginPath();ctx.arc(lx,ly,dist*0.1,0,Math.PI*2);ctx.fill()
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

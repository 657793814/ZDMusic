// 💥 SUPERNOVA — 超新星爆发
import type { PresetModule } from "./types";

interface SNStar{x:number;y:number;z:number;size:number;hue:number;twP:number;twS:number}
interface SNShockWave{radius:number;speed:number;alpha:number;hue:number;width:number;phase:number}
interface SNDebris{x:number;y:number;vx:number;vy:number;size:number;hue:number;alpha:number;life:number}

const STAR_COUNT=400,MAX_SHOCKS=6,DEBRIS_COUNT=300
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
function makeStar():SNStar{return{x:ra(-1.5,1.5),y:ra(-1.5,1.5),z:ra(0.5,8),size:ra(0.03,0.2),hue:ra(200,350),twP:ra(0,Math.PI*2),twS:ra(0.3,2)}}

export const preset:PresetModule={
  definition:{id:"supernova",name:"超新星爆发",icon:"💥",description:"冲击波与碎片飞散"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const stars:SNStar[]=[],shocks:SNShockWave[]=[],debris:SNDebris[]=[]
    for(let i=0;i<STAR_COUNT;i++)stars.push(makeStar())
    for(let i=0;i<DEBRIS_COUNT;i++)debris.push({x:ra(-0.05,0.05),y:ra(-0.05,0.05),vx:ra(-0.005,0.005),vy:ra(-0.005,0.005),size:ra(0.2,2),hue:ri(0,40),alpha:ra(0.3,1),life:ra(0.3,1)})

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0,burstCooldown=0

    function resize(){
      const dpr=window.devicePixelRatio||1
      canvas.width=window.innerWidth*dpr;canvas.height=window.innerHeight*dpr
      canvas.style.width=`${window.innerWidth}px`;canvas.style.height=`${window.innerHeight}px`
      ctx.setTransform(dpr,0,0,dpr,0,0)
    }
    resize();window.addEventListener("resize",resize)

    function triggerBurst(){
      shocks.push({radius:0,speed:ra(0.005,0.015),alpha:0.4,hue:ri(0,50),width:ra(0.02,0.06),phase:ra(0,Math.PI*2)})
      if(shocks.length>MAX_SHOCKS)shocks.shift()
      for(let i=0;i<40;i++){
        const d=debris[ri(0,DEBRIS_COUNT-1)]
        d.x=ra(-0.05,0.05);d.y=ra(-0.05,0.05)
        const angle=ra(0,Math.PI*2),speed=ra(0.003,0.015)
        d.vx=Math.cos(angle)*speed;d.vy=Math.sin(angle)*speed
        d.size=ra(0.3,2.5);d.hue=ri(0,50);d.alpha=ra(0.4,1);d.life=1
      }
    }

    function draw(){
      if(stopped)return;raf=requestAnimationFrame(draw);frame++
      const W=window.innerWidth,H=window.innerHeight,CX=W/2,CY=H/2,SS=Math.min(W,H)

      if(analyser&&playing){
        analyser.getByteFrequencyData(freq);const L=freq.length;let sum=0;for(let i=0;i<L;i++)sum+=freq[i]
        avgE=avgE*0.85+(sum/L/255)*0.15;const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4;const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}

      if(burstCooldown>0)burstCooldown--
      const trans=Math.abs(bass-0.3)*2
      if(playing&&bass>0.5&&Math.random()<trans*0.3&&burstCooldown===0){triggerBurst();burstCooldown=30}

      // 背景
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.7)
      bg.addColorStop(0,"rgba(8,3,12,1)");bg.addColorStop(0.5,"rgba(12,5,18,1)");bg.addColorStop(1,"rgba(5,2,8,1)")
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

      // 冲击波环
      for(let si=shocks.length-1;si>=0;si--){
        const sw=shocks[si]
        sw.radius+=sw.speed*(1+bass*0.5)
        sw.alpha*=(1-0.003*(1+bass))
        const swR=sw.radius*SS*0.45
        const swA=sw.alpha*(0.3+avgE*0.3)
        if(swA<0.001||swR>SS*0.7){shocks.splice(si,1);continue}
        ctx.beginPath();ctx.arc(CX,CY,swR,0,Math.PI*2)
        ctx.strokeStyle=`hsla(${sw.hue},90%,${60+sw.alpha*30}%,${swA})`
        ctx.lineWidth=Math.max(0.5,sw.width*SS*0.15*(1-sw.radius));ctx.stroke()
      }

      // 碎屑
      for(const d of debris){
        d.x+=d.vx*(1+bass+mid*0.5);d.y+=d.vy*(1+bass+mid*0.5)
        d.life-=0.001*(1+bass*0.3)
        const dx=CX+d.x*SS*0.45,dy=CY+d.y*SS*0.45
        const dA=d.alpha*d.life*(0.3+avgE*0.5)
        if(dA<0.003)continue
        const sz=d.size*(0.5+avgE*0.5)
        ctx.beginPath();ctx.arc(dx,dy,Math.max(0.2,sz),0,Math.PI*2)
        ctx.fillStyle=`hsla(${d.hue},80%,${40+d.life*40}%,${dA})`
        ctx.fill()
        if(sz>0.8){
          const g=ctx.createRadialGradient(dx,dy,0,dx,dy,sz*3)
          g.addColorStop(0,`hsla(${d.hue},70%,60%,${dA*0.2})`);g.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=g;ctx.beginPath();ctx.arc(dx,dy,sz*3,0,Math.PI*2);ctx.fill()
        }
      }

      // 爆心余辉
      const coreA=0.15+bass*0.3+avgE*0.15
      const cg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.06)
      cg.addColorStop(0,`rgba(255,220,180,${coreA})`)
      cg.addColorStop(0.3,`rgba(255,160,80,${coreA*0.5})`)
      cg.addColorStop(0.6,`rgba(200,80,100,${coreA*0.2})`)
      cg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(CX,CY,SS*0.06,0,Math.PI*2);ctx.fill()

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

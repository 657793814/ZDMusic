// 🌆 NEON CITY — 幻光都市
import type { PresetModule } from "./types";

interface NCBuilding{x:number;height:number;width:number;hue:number;light:number;phase:number}
interface NCTraffic{road:number;t:number;speed:number;hue:number;bright:number}

const BUILDING_COUNT=80,TRAFFIC_COUNT=60,GRID_LINES=20
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))

function makeBuilding():NCBuilding{return{x:ra(-1,1),height:ra(0.1,0.6),width:ra(0.03,0.1),hue:ri(200,300),light:ra(0.3,0.9),phase:ra(0,Math.PI*2)}}
function makeTraffic():NCTraffic{return{road:ri(0,4),t:ra(0,1),speed:ra(0.005,0.015),hue:ri(0,60),bright:ra(0.3,1)}}

export const preset:PresetModule={
  definition:{id:"neon-city",name:"幻光都市",icon:"🌆",description:"赛博朋克光轨城市"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const buildings=Array.from({length:BUILDING_COUNT},()=>makeBuilding())
    const traffic=Array.from({length:TRAFFIC_COUNT},()=>makeTraffic())

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
      const W=window.innerWidth,H=window.innerHeight,CX=W/2,SS=Math.min(W,H)

      if(analyser&&playing){
        analyser.getByteFrequencyData(freq);const L=freq.length;let sum=0;for(let i=0;i<L;i++)sum+=freq[i]
        avgE=avgE*0.85+(sum/L/255)*0.15;const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4;const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}

      const speedMul=0.5+bass*1.5

      // 背景（深空蓝紫）
      ctx.clearRect(0,0,W,H)
      const sky=ctx.createLinearGradient(0,0,0,H)
      sky.addColorStop(0,"rgba(5,3,15,1)");sky.addColorStop(0.4,"rgba(10,5,20,1)");sky.addColorStop(1,"rgba(15,8,25,1)")
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H)

      // 透视网格道路
      ctx.save();ctx.translate(CX,H)
      const vanishY=H*0.35
      const gridA=0.08+avgE*0.06+bass*0.04
      for(let i=-GRID_LINES/2;i<=GRID_LINES/2;i++){
        const t=i/(GRID_LINES/2)
        const x=t*SS*0.5
        const yStart=0,yEnd=-H*0.9
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x*t*0.2*(1+avgE),yEnd)
        ctx.strokeStyle=`hsla(240,70%,50%,${gridA*(1-Math.abs(t)*0.5)})`;ctx.lineWidth=0.5;ctx.stroke()
      }

      // 建筑
      for(const b of buildings){
        const bH=b.height*SS*0.3
        const bW=b.width*SS*0.12
        const bx=b.x*SS*0.4
        const by=-bH
        const pulse=0.5+Math.sin(frame*0.02+b.phase+mid*3)*0.5
        const bA=(0.3+b.light*0.3+avgE*0.2+mid*0.1)*pulse
        if(bA<0.01)continue
        ctx.fillStyle=`hsla(${b.hue},60%,${30+20*pulse}%,${bA*0.6})`
        ctx.fillRect(bx-bW/2,by-H*0.1,bW,bH)
        ctx.strokeStyle=`hsla(${b.hue},80%,70%,${bA*0.3})`;ctx.lineWidth=0.5
        ctx.strokeRect(bx-bW/2,by-H*0.1,bW,bH)
        for(let wi=0;wi<5;wi++){
          const wy=by-H*0.1+bH*(0.1+wi*0.2)
          const wPulse=0.3+Math.sin(frame*0.03+b.phase+wi)*0.7
          ctx.fillStyle=`hsla(${b.hue+20},80%,70%,${bA*0.2*wPulse})`
          ctx.fillRect(bx-bW*0.3,wy,bW*0.6,Math.max(1,bH*0.06))
        }
      }

      // 车流光轨
      for(const t of traffic){
        t.t+=t.speed*speedMul
        if(t.t>1)t.t-=1
        const roadX=(t.road-2)/2*SS*0.15
        const x=CX+roadX*(1-t.t*0.6)
        const y=H-t.t*H*0.65
        const size=1+t.t*3
        const tA=t.bright*(0.3+avgE*0.5+bass*0.3)*(1-t.t*0.5)
        if(tA<0.005)continue
        ctx.beginPath();ctx.arc(x,y,Math.max(0.5,size),0,Math.PI*2)
        ctx.fillStyle=`hsla(${t.hue},90%,70%,${tA})`
        ctx.fill()
        const trailLen=0.05+size*0.005
        const startT=Math.max(0,t.t-trailLen)
        const sx=CX+roadX*(1-startT*0.6);const sy=H-startT*H*0.65
        const grad=ctx.createLinearGradient(sx,sy,x,y)
        grad.addColorStop(0,`hsla(${t.hue},80%,60%,${tA*0.3})`);grad.addColorStop(1,`hsla(${t.hue},80%,60%,0)`)
        ctx.strokeStyle=grad;ctx.lineWidth=size*0.5
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(x,y);ctx.stroke()
      }

      ctx.restore()

      // 地面辉光
      const gnd=ctx.createLinearGradient(0,H*0.7,0,H)
      gnd.addColorStop(0,"rgba(0,0,20,0)");gnd.addColorStop(1,`rgba(80,40,120,${0.04+avgE*0.04})`)
      ctx.fillStyle=gnd;ctx.fillRect(0,H*0.7,W,H*0.3)

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

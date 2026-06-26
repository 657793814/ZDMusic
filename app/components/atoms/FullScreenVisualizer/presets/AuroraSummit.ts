// 🌌 AURORA SUMMIT — 极光之巅
import type { PresetModule } from "./types";

interface ASStar{x:number;y:number;z:number;size:number;hue:number;twinkle:number}
interface AuroraCurtain{
  x:number;width:number;height:number;hue:number;hueWidth:number;
  sat:number;light:number;alpha:number;waveFreq:number;waveAmp:number;waveSpeed:number;bands:number;offset:number;
}

const STAR_COUNT=300,CURTAIN_COUNT=8
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const sst=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t)}

function makeStar():ASStar{return{x:ra(-1.5,1.5),y:ra(-1.5,1.5),z:ra(1,8),size:ra(0.05,0.3),hue:ra(200,350),twinkle:ra(0.3,1)}}

function makeCurtain(i:number):AuroraCurtain{
  const hues=[90,120,150,180,210,260,280,300]
  const hue=hues[i%hues.length]
  return{
    x:ra(-0.1,1.1),width:ra(0.2,0.5),height:ra(0.2,0.7),
    hue,hueWidth:ra(10,40),sat:ri(60,90),light:ri(50,75),
    alpha:ra(0.08,0.25),waveFreq:ra(1.5,4),waveAmp:ra(0.02,0.08),
    waveSpeed:ra(0.005,0.02),bands:ri(15,35),offset:ra(0,Math.PI*2)
  }
}

export const preset:PresetModule={
  definition:{id:"aurora-summit",name:"极光之巅",icon:"🌌",description:"全屏极光幕帘"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const stars:ASStar[]=[],curtains:AuroraCurtain[]=[]
    for(let i=0;i<STAR_COUNT;i++)stars.push(makeStar())
    for(let i=0;i<CURTAIN_COUNT;i++)curtains.push(makeCurtain(i))

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

      const waveAmpMul=1+bass*2

      // 天空背景
      ctx.clearRect(0,0,W,H)
      const sky=ctx.createLinearGradient(0,0,0,H)
      sky.addColorStop(0,"rgba(5,3,15,1)");sky.addColorStop(0.3,"rgba(10,5,20,1)")
      sky.addColorStop(0.6,`rgba(15,10,25,${1+avgE*0.2})`);sky.addColorStop(1,"rgba(5,8,15,1)")
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H)

      // 地平线辉光
      const hg=ctx.createRadialGradient(CX,H,0,CX,H,SS*0.5)
      hg.addColorStop(0,`hsla(120,40%,20%,${0.04+avgE*0.04})`)
      hg.addColorStop(0.4,`hsla(150,30%,15%,${0.03+avgE*0.03})`)
      hg.addColorStop(1,"hsla(0,0%,0%,0)")
      ctx.fillStyle=hg;ctx.fillRect(0,0,W,H)

      // 星场
      for(const s of stars){
        s.z-=0.003*(1+mid*0.5)
        if(s.z<=0.5){Object.assign(s,makeStar());continue}
        const sx=CX+(s.x/s.z)*W*0.5,sy=CY+(s.y/s.z)*H*0.4
        if(sx<-30||sx>W+30||sy<-30||sy>H+30){Object.assign(s,makeStar());continue}
        const sz2=Math.min(2.5,s.size*(1/Math.max(0.2,s.z))*0.004*SS),db=Math.min(1,(6-s.z)/6*2),twinkle=0.5+Math.sin(frame*0.03+s.twinkle*10)*0.5
        if(sz2>0.15){ctx.beginPath();ctx.arc(sx,sy,sz2*0.6,0,Math.PI*2);ctx.fillStyle=`hsla(${s.hue},40%,${50+db*30}%,${db*0.4*twinkle})`;ctx.fill()}
      }

      // 极光幕帘
      for(const c of curtains){
        const cA=c.alpha*(0.5+avgE)
        if(cA<0.003)continue
        for(let bi=0;bi<c.bands;bi++){
          const bt=bi/c.bands
          const bx=(c.x+bt*c.width)*W
          const bandWave=Math.sin(bt*c.waveFreq*Math.PI*2+frame*c.waveSpeed+c.offset)*c.waveAmp*waveAmpMul
          const bandWave2=Math.sin(bt*c.waveFreq*0.5*Math.PI*2+frame*c.waveSpeed*0.7+c.offset*1.3)*c.waveAmp*0.5*waveAmpMul
          const topY=H*(1-c.height+bandWave+bandWave2)
          const botY=H*0.95
          if(topY<0||topY>botY)continue
          const intensity=1-Math.abs(bt-0.5)*1.5
          if(intensity<=0)continue
          const bandAlpha=cA*intensity*(0.5+Math.sin(frame*0.01+bi)*0.2)
          const grad=ctx.createLinearGradient(0,topY,0,botY)
          const hue=c.hue+bt*c.hueWidth*Math.sin(frame*0.005+c.offset)*0.3
          grad.addColorStop(0,`hsla(${hue},${c.sat}%,${c.light+20}%,0)`)
          grad.addColorStop(0.2,`hsla(${hue},${c.sat}%,${c.light+15}%,${bandAlpha*0.7})`)
          grad.addColorStop(0.5,`hsla(${hue},${c.sat+5}%,${c.light+20}%,${bandAlpha})`)
          grad.addColorStop(0.8,`hsla(${hue+10},${c.sat-5}%,${c.light+5}%,${bandAlpha*0.6})`)
          grad.addColorStop(1,`hsla(${hue+20},${c.sat*0.5}%,${c.light-10}%,0)`)
          ctx.fillStyle=grad;ctx.fillRect(bx-1,topY,(c.width/c.bands)*W+2,botY-topY)
        }
      }

      // 底部地形剪影
      ctx.beginPath();ctx.moveTo(0,H)
      for(let x=0;x<=W;x+=4){
        const yy=H-10-Math.sin(x*0.003)*8-Math.sin(x*0.008)*5-Math.sin(x*0.015)*3-bass*4
        ctx.lineTo(x,yy)
      }
      ctx.lineTo(W,H);ctx.closePath()
      ctx.fillStyle="rgba(3,4,8,0.6)";ctx.fill()

      // 地面辉光
      const gnd=ctx.createLinearGradient(0,H-30,0,H)
      gnd.addColorStop(0,`hsla(120,30%,10%,${0.04+avgE*0.04})`);gnd.addColorStop(1,"hsla(120,30%,5%,0)")
      ctx.fillStyle=gnd;ctx.fillRect(0,H-30,W,30)

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

// 🌌 AURORA SUMMIT — 极光之巅 (v2)
// 全屏极光幕帘 + 垂直光柱 + 星空
import type { PresetModule } from "./types";

interface AuroraCurtain{
  x:number;width:number;hue:number;hueWidth:number;alpha:number;
  waveFreq:number;waveAmp:number;waveSpeed:number;offset:number;
}
interface AuroraPillar{
  x:number;height:number;width:number;hue:number;alpha:number;phase:number;
}
interface Star{px:number;py:number;size:number;bright:number;twinklePhase:number}

const CURTAINS=10,PILLARS=20,STARS=200
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))

function makeCurtain(i:number):AuroraCurtain{
  const hues=[100,140,180,220,260,280,120,160,200,240]
  return{
    x:ra(-0.1,1.1),width:ra(0.25,0.6),
    hue:hues[i%hues.length],hueWidth:ra(20,50),
    alpha:ra(0.15,0.4),waveFreq:ra(1.5,4.5),waveAmp:ra(0.03,0.1),
    waveSpeed:ra(0.004,0.018),offset:ra(0,Math.PI*2),
  }
}
function makePillar():AuroraPillar{
  return{
    x:ra(0.05,0.95),height:ra(0.3,0.85),width:ra(0.02,0.06),
    hue:ri(100,280),alpha:ra(0.04,0.15),phase:ra(0,Math.PI*2),
  }
}
function makeStar():Star{
  return{px:ra(0,1),py:ra(0,0.4),size:ra(0.3,1.5),bright:ra(0.3,1),twinklePhase:ra(0,Math.PI*2)}
}

export const preset:PresetModule={
  definition:{id:"aurora-summit",name:"极光之巅",icon:"🌌",description:"全屏极光幕帘"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const curtains=Array.from({length:CURTAINS},(_,i)=>makeCurtain(i))
    const pillars=Array.from({length:PILLARS},()=>makePillar())
    const stars=Array.from({length:STARS},()=>makeStar())

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
      const W=window.innerWidth,H=window.innerHeight,SS=Math.min(W,H)

      if(analyser&&playing){
        analyser.getByteFrequencyData(freq);const L=freq.length;let sum=0;for(let i=0;i<L;i++)sum+=freq[i]
        avgE=avgE*0.85+(sum/L/255)*0.15;const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4;const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}

      const intensityMul=1+bass*2.5+avgE

      // ─── 天空 ───
      ctx.clearRect(0,0,W,H)
      const sky=ctx.createLinearGradient(0,0,0,H)
      sky.addColorStop(0,"rgba(4,2,12,1)");sky.addColorStop(0.4,"rgba(10,5,22,1)")
      sky.addColorStop(0.7,"rgba(20,12,30,1)");sky.addColorStop(1,"rgba(8,12,16,1)")
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H)

      // ─── 星空 ───
      for(const s of stars){
        s.twinklePhase+=0.03*(1+mid*0.3)
        const blink=0.5+0.5*Math.sin(s.twinklePhase)
        ctx.beginPath()
        ctx.arc(s.px*W,s.py*H,s.size*(0.3+blink*0.7),0,Math.PI*2)
        ctx.fillStyle=`hsla(0,0%,${60+30*s.bright}%,${s.bright*0.6*blink*(0.3+avgE*0.3)})`
        ctx.fill()
      }

      // ─── 极光幕帘（半透明叠加，彩色） ───
      for(const c of curtains){
        const cA=c.alpha*(0.3+0.7*avgE)*(0.6+0.4*Math.sin(frame*0.003+c.offset))
        if(cA<0.005)continue
        const segs=Math.floor(W*0.04)
        for(let si=0;si<segs;si++){
          const st=si/segs
          const x=c.x*W+st*c.width*W
          // 波动曲线
          const wave1=Math.sin(st*c.waveFreq*Math.PI*2+frame*c.waveSpeed+c.offset)
          const wave2=Math.sin(st*c.waveFreq*0.5*Math.PI*2+frame*c.waveSpeed*0.7+c.offset*1.3)
          const topY=H*(0.05+0.1*avgE)+(wave1*c.waveAmp+wave2*c.waveAmp*0.5)*H*intensityMul
          const botY=H*(0.85+0.08*avgE)+wave1*H*0.02*intensityMul
          if(topY<0||topY>botY)continue
          const intensity=1-Math.abs(st-0.5)*1.2
          if(intensity<=0)continue
          const bandA=cA*intensity*(0.5+0.5*Math.sin(frame*0.015+si*0.3+c.offset))
          const hue=c.hue+st*c.hueWidth*Math.sin(frame*0.004+c.offset)*0.4
          // 垂直渐变：上淡下亮再渐消
          const gh=botY-topY
          const grad=ctx.createLinearGradient(0,topY,0,botY)
          grad.addColorStop(0,`hsla(${hue},80%,60%,0)`)
          grad.addColorStop(0.1,`hsla(${hue},85%,65%,${bandA*0.4})`)
          grad.addColorStop(0.35,`hsla(${hue+5},90%,70%,${bandA})`)
          grad.addColorStop(0.65,`hsla(${hue+15},85%,65%,${bandA*0.8})`)
          grad.addColorStop(0.85,`hsla(${hue+20},70%,55%,${bandA*0.3})`)
          grad.addColorStop(1,`hsla(${hue+30},50%,40%,0)`)
          ctx.fillStyle=grad
          ctx.fillRect(x-(c.width*W)/(segs*1.2),topY,(c.width*W)/(segs*0.9)+1,gh)
        }
      }

      // ─── 垂直光柱 ───
      for(const p of pillars){
        const pulse=0.3+0.7*Math.sin(frame*0.02+p.phase+mid*4)
        const pA=p.alpha*(0.2+0.8*avgE+0.5*bass)*pulse
        if(pA<0.003)continue
        const px=p.x*W,pw=p.width*W*(0.5+avgE*0.5)
        const ph=p.height*H
        const pTop=H*(0.08+0.05*avgE)
        const pg=ctx.createLinearGradient(0,H,0,H-ph)
        pg.addColorStop(0,`hsla(${p.hue},90%,70%,0)`)
        pg.addColorStop(0.2,`hsla(${p.hue},95%,75%,${pA*0.5})`)
        pg.addColorStop(0.5,`hsla(${p.hue+10},100%,80%,${pA})`)
        pg.addColorStop(0.7,`hsla(${p.hue+20},90%,70%,${pA*0.6})`)
        pg.addColorStop(1,`hsla(${p.hue+30},70%,55%,0)`)
        ctx.fillStyle=pg
        ctx.fillRect(px-pw/2,H-ph,pw,ph-pTop)
      }

      // ─── 底部地形 ───
      ctx.beginPath();ctx.moveTo(0,H)
      for(let xx=0;xx<=W;xx+=3){
        const yy=H-12-Math.sin(xx*0.002)*10-Math.sin(xx*0.006)*6-Math.sin(xx*0.012)*3-bass*3
        ctx.lineTo(xx,yy)
      }
      ctx.lineTo(W,H);ctx.closePath()
      ctx.fillStyle="rgba(3,5,10,0.7)";ctx.fill()

      // 地面辉光
      const gnd=ctx.createLinearGradient(0,H*0.97,0,H)
      gnd.addColorStop(0,"rgba(50,80,40,0)")
      gnd.addColorStop(0.5,`rgba(60,100,50,${0.02+avgE*0.03})`)
      gnd.addColorStop(1,`rgba(80,120,60,${0.01+avgE*0.02})`)
      ctx.fillStyle=gnd;ctx.fillRect(0,H*0.97,W,H*0.03)

      // 地平线极光辉光
      const hg=ctx.createRadialGradient(W/2,H,0,W/2,H,SS*0.4)
      hg.addColorStop(0,`hsla(140,60%,30%,${0.07+avgE*0.08+bass*0.06})`)
      hg.addColorStop(0.5,`hsla(180,50%,25%,${0.04+avgE*0.05})`)
      hg.addColorStop(1,"hsla(0,0%,0%,0)")
      ctx.fillStyle=hg;ctx.fillRect(0,0,W,H)

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

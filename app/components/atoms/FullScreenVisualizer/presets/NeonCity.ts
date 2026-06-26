// 🌆 NEON CITY — 幻光都市 (v7)
// 城市灯光秀：音乐填充摩天楼 + 不重叠布局 + 地标超高楼
import type { PresetModule } from "./types";

interface Building {
  x:number;           // 屏幕坐标 px
  w:number;           // 宽度 px
  h:number;           // 高度比 0.35~0.95
  baseHue:number;
  colorGroup:number;
  phase:number;
  roof:number;
  landmark:boolean;   // 地标超高楼
  hasWindows:boolean;
}
interface Beam{
  angle:number;prog:number;speed:number;hue:number;
}

const LANDMARKS=5,COMMON=40,BEAMS=4
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const HUE_GROUPS=[[220,255],[170,195],[285,315]]

function makeBuildings():Building[]{
  const result:Building[]=[]
  // 地标超高楼 — 均匀分布
  for(let i=0;i<LANDMARKS;i++){
    const x=-0.82+i*1.64/(LANDMARKS-1)
    const cg=ri(0,2)
    result.push({
      x, w:ra(0.04,0.065), h:ra(0.7,0.95),
      baseHue:ri(HUE_GROUPS[cg][0],HUE_GROUPS[cg][1]),
      colorGroup:cg, phase:ra(0,Math.PI*2),
      roof:ri(0,3), landmark:true, hasWindows:true,
    })
  }
  // 普通建筑 — 均匀插缝
  const totalSlots=COMMON+LANDMARKS
  let idx=0
  for(let i=0;i<totalSlots;i++){
    const x=-0.84+i*1.68/(totalSlots-1)
    // 如果这个位置离地标太近就跳过
    if(result.some(b=>Math.abs(b.x-x)<0.025))continue
    const cg=ri(0,2)
    result.push({
      x, w:ra(0.012,0.03), h:ra(0.3,0.65),
      baseHue:ri(HUE_GROUPS[cg][0],HUE_GROUPS[cg][1]),
      colorGroup:cg, phase:ra(0,Math.PI*2),
      roof:ri(0,3), landmark:false, hasWindows:Math.random()>0.2,
    })
    idx++
    if(idx>=COMMON)break
  }
  return result
}
function makeBeam():Beam{
  return{angle:ra(0,Math.PI*2),prog:ra(0,1),speed:ra(0.002,0.006),hue:ri(220,280)}
}

export const preset:PresetModule={
  definition:{id:"neon-city",name:"幻光都市",icon:"🌆",description:"城市灯光秀"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const bldgs=makeBuildings()
    const beams=Array.from({length:BEAMS},()=>makeBeam())

    const freq=new Uint8Array(analyser?.frequencyBinCount??128)
    let avgE=0,bass=0,mid=0,frame=0,beat=0,prevBass=0

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
        avgE=avgE*0.85+(sum/L/255)*0.15
        const bc=Math.floor(L/4);let bs=0;for(let i=0;i<bc;i++)bs+=freq[i]
        bass=bass*0.6+(bs/bc/255)*0.4
        const mc=L-bc;let ms=0;for(let i=bc;i<L;i++)ms+=freq[i]
        mid=mid*0.7+(ms/mc/255)*0.3
      }else{avgE*=0.97;bass*=0.95;mid*=0.95}

      if(bass>0.25&&bass>prevBass*1.25)beat=Math.min(1,1.2+bass*0.5);else beat*=0.9
      prevBass=bass

      // ─── 天空 ───
      ctx.clearRect(0,0,W,H)
      const sky=ctx.createLinearGradient(0,0,0,H)
      sky.addColorStop(0,"hsl(240,35%,1%)");sky.addColorStop(0.5,"hsl(240,30%,5%)")
      sky.addColorStop(0.8,"hsl(240,25%,12%)");sky.addColorStop(1,"hsl(240,20%,17%)")
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H)

      // ─── 星空 ───
      for(let i=0;i<25;i++){
        ctx.beginPath();ctx.arc(ra(0,W),ra(0,H*0.18),ra(0.3,1),0,Math.PI*2)
        ctx.fillStyle=`hsla(0,0%,80%,${ra(0.06,0.18)})`;ctx.fill()
      }

      // ─── 探照灯 ───
      for(const bm of beams){
        bm.prog+=bm.speed*(1+bass*2)
        if(bm.prog>1){bm.prog=0;bm.angle=ra(0,Math.PI*2);bm.speed=ra(0.002,0.006);bm.hue=ri(220,280)}
        const a=bm.angle+0.12*Math.sin(frame*0.005+bm.prog*3)
        ctx.save();ctx.translate(CX,H*0.92);ctx.rotate(a-Math.PI/2)
        const len=SS*0.3,bA=0.012+avgE*0.02
        const lg=ctx.createLinearGradient(0,0,0,-len)
        lg.addColorStop(0,`hsla(${bm.hue},80%,70%,${bA})`)
        lg.addColorStop(1,"hsla(0,0%,0%,0)")
        ctx.fillStyle=lg;ctx.beginPath()
        ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.lineTo(0,-len);ctx.closePath()
        ctx.fill();ctx.restore()
      }

      // ─── 城市 ───
      const groundY=H*0.82
      const maxH=groundY*0.4

      for(const b of bldgs){
        const bw=b.w*W
        const topH=b.h*maxH
        const bx=CX+b.x*W*0.45
        const by=groundY

        // 填充比例
        const bassPulse=Math.max(0,bass*2*(0.5+0.5*Math.sin(frame*0.03+b.phase*0.7)))
        const midPulse=mid*0.8*(0.5+0.5*Math.sin(frame*0.05+b.phase*1.3))
        const energy=avgE*0.3+beat*0.2
        const fill=Math.min(1,Math.max(0.02,bassPulse+midPulse+energy))

        // — 建筑暗体 —
        ctx.fillStyle=`hsla(${b.baseHue},35%,8%,${b.landmark?0.8:0.6})`
        ctx.fillRect(bx-bw/2,by-topH,bw,topH)

        // — 填充发光（从下往上） —
        const filledH=topH*fill
        const segs=Math.max(6,Math.floor(topH/4))
        const segH=topH/segs
        const fillSegs=Math.max(1,Math.floor(fill*segs))

        for(let si=0;si<fillSegs;si++){
          const st=si/segs
          const bright=1.0-0.35*st+beat*0.25
          const h=b.baseHue+st*10
          const light=30+bright*40
          const alpha=0.45+bright*0.55
          const segY=by-topH+segH*si
          ctx.fillStyle=`hsla(${h},85%,${light}%,${alpha})`
          ctx.fillRect(bx-bw/2,segY-segH,bw,segH+1)
        }

        // — 窗户（未填充区域） —
        if(b.hasWindows&&fill<0.95){
          const cols=Math.max(2,Math.floor(bw/4))
          const rows=Math.max(4,Math.floor(topH/5))
          const cw=bw/(cols+1),ch=topH/(rows+1)
          for(let ci=0;ci<cols;ci++){
            for(let ri2=0;ri2<rows;ri2++){
              const st2=ri2/rows
              if(st2<fill)continue
              const wA=(0.1+0.2*(0.5+0.5*Math.sin(frame*0.03+b.phase+ci*2+ri2*1.3)))*(0.5+avgE*0.3)
              if(wA<0.04)continue
              const wx=bx-bw/2+cw*(ci+1),wy=by-topH+ch*(ri2+1)
              ctx.fillStyle=`hsla(${b.baseHue+15},70%,65%,${wA})`
              ctx.fillRect(wx-cw*0.2,wy-ch*0.2,cw*0.4,ch*0.4)
            }
          }
        }

        // — 填充顶端发光 —
        if(fill>0.05){
          const fillTopY=by-filledH
          const glowR=bw*(b.landmark?4:2.5)
          const fg=ctx.createRadialGradient(bx,fillTopY,0,bx,fillTopY,glowR)
          fg.addColorStop(0,`hsla(${b.baseHue+10},100%,80%,${(0.2+fill*0.4+beat*0.3)*(b.landmark?1.5:1)})`)
          fg.addColorStop(1,"hsla(0,0%,0%,0)")
          ctx.fillStyle=fg;ctx.beginPath();ctx.arc(bx,fillTopY,glowR,0,Math.PI*2)
          ctx.fill()
        }

        // — 建筑轮廓 —
        ctx.strokeStyle=`hsla(${b.baseHue},55%,50%,${0.06+fill*0.1})`
        ctx.lineWidth=0.5;ctx.strokeRect(bx-bw/2,by-topH,bw,topH)

        // — 楼顶造型 —
        const roofY=by-topH
        if(b.roof===1){
          ctx.beginPath()
          ctx.moveTo(bx-bw*0.25,roofY)
          ctx.lineTo(bx,roofY-(b.landmark?topH*0.08:topH*0.06))
          ctx.lineTo(bx+bw*0.25,roofY)
          ctx.closePath()
          ctx.fillStyle=`hsla(${b.baseHue+20},80%,65%,${0.12+fill*0.18+beat*0.15})`
          ctx.fill()
        }else if(b.roof===2){
          const aH=topH*(b.landmark?0.1:0.06),aW=Math.max(0.5,bw*0.04)
          ctx.fillStyle=`hsla(${b.baseHue+20},70%,60%,${0.15+fill*0.2+beat*0.1})`
          ctx.fillRect(bx-aW/2,roofY-aH,aW,aH)
          ctx.beginPath();ctx.arc(bx,roofY-aH-1,Math.max(1,bw*(b.landmark?0.035:0.025)),0,Math.PI*2)
          ctx.fillStyle=`hsla(0,90%,70%,${0.25+beat*0.3})`;ctx.fill()
        }else if(b.roof===3){
          const stepH=topH*0.03
          ctx.fillStyle=`hsla(${b.baseHue+10},70%,50%,${0.08+fill*0.12})`
          ctx.fillRect(bx-bw*0.3,roofY,bw*0.6,stepH)
        }

        // — 底部辉光 —
        ctx.fillStyle=`hsla(${b.baseHue},80%,60%,${0.04+fill*0.07+bass*0.05})`
        ctx.fillRect(bx-bw/2,by-3,bw,3)
      }

      // ─── 地面 ───
      ctx.fillStyle="rgba(8,6,16,0.5)";ctx.fillRect(0,groundY,W,H-groundY)
      const gnd=ctx.createLinearGradient(0,groundY,0,H)
      gnd.addColorStop(0,`rgba(40,20,100,${0.04+avgE*0.05+bass*0.04})`)
      gnd.addColorStop(0.5,`rgba(60,30,120,${0.02+avgE*0.03})`)
      gnd.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=gnd;ctx.fillRect(0,groundY,W,H-groundY)

      // --- 能量柱 ---
      if(analyser&&playing&&freq.length>0){
        const step=Math.max(1,Math.floor(freq.length/48)),mH=H*0.05,bw=3,gap=1,tw=48*(bw+gap),sx=(W-tw)/2
        for(let i=0;i<48;i++){let s=0;const st=i*step,en=Math.min(st+step,freq.length);for(let j=st;j<en;j++)s+=freq[j];const n=s/(en-st)/255,bh=Math.max(1,n*mH),y=H-bh;ctx.fillStyle=`hsla(${220+n*80},70%,${40+n*30}%,${0.08+n*0.12})`;ctx.fillRect(sx+i*(bw+gap),y,bw,bh)}
      }
    }
    draw()
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize)}
  },
}

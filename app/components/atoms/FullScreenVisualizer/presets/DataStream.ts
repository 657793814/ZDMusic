// 💾 DATA STREAM — 数据流
import type { PresetModule } from "./types";

interface DSColumn{x:number;chars:{char:string;y:number;bright:number;speed:number}[];hue:number;speed:number;len:number;phase:number}

const COLS=40,COLS_PER_COL=12,TUNNEL_COLS=20,TUNNEL_ROWS=15
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))
const CHARS="アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>[]{}/*-+=.:;!?"
function randChar():string{return CHARS[ri(0,CHARS.length-1)]}
function makeColumn(i:number):DSColumn{
  const chars=[]
  for(let j=0;j<COLS_PER_COL;j++)chars.push({char:randChar(),y:ra(-10,1),bright:ra(0.3,1),speed:ra(0.005,0.02)})
  return{x:(i/COLS)*2-1,chars,hue:ri(100,160),speed:ra(0.004,0.015),len:ri(5,15),phase:ra(0,Math.PI*2)}
}

export const preset:PresetModule={
  definition:{id:"data-stream",name:"数据流",icon:"💾",description:"Matrix 数字雨隧道"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const cols=Array.from({length:COLS},(_,i)=>makeColumn(i))

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

      const speedMul=0.5+bass*2+mid*0.5
      const fontSize=Math.max(8,SS*0.025)

      // 背景
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.6)
      bg.addColorStop(0,"rgba(0,5,0,1)");bg.addColorStop(0.5,"rgba(0,3,8,1)");bg.addColorStop(1,"rgba(0,2,5,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // 数据隧道墙面
      ctx.save();ctx.translate(CX,CY*0.5)
      ctx.font=`${fontSize*0.8}px monospace`;ctx.textAlign="center"
      for(let ri2=0;ri2<TUNNEL_ROWS;ri2++){
        const rt=ri2/TUNNEL_ROWS
        const y=rt*H*0.8
        const scale=1-rt*0.6
        if(scale<0.1)continue
        for(let ci=0;ci<TUNNEL_COLS;ci++){
          const ct=ci/TUNNEL_COLS
          const x=(ct-0.5)*W*scale
          const b=0.1+Math.sin(frame*0.02+ri2+ci)*0.1*mid+avgE*0.1
          const c=CHARS[(Math.floor(frame*0.05+ri2*17+ci*13))%CHARS.length]
          ctx.fillStyle=`hsla(120,80%,${20+b*30}%,${b*0.2})`
          ctx.fillText(c,x,y)
        }
      }
      ctx.restore()

      // 数据雨
      ctx.font=`${fontSize}px monospace`;ctx.textAlign="center"
      for(const c of cols){
        for(const ch of c.chars){
          ch.y+=ch.speed*speedMul
          if(ch.y>1.2){ch.y=ra(-2,0);ch.char=randChar();ch.bright=ra(0.3,1);ch.speed=ra(0.005,0.02)}
          const cx=CX+c.x*W*0.4
          const cy=CY+ch.y*H*0.5
          if(cy<0||cy>H)continue
          const distFromCenter=Math.abs(c.x)
          const chA=ch.bright*(0.3+avgE*0.5+bass*0.3)*(1-distFromCenter*0.3)
          if(chA<0.01)continue
          const isLead=ch===c.chars.reduce((a,b)=>a.y>b.y?a:b)
          if(isLead){
            ctx.fillStyle=`hsla(${c.hue},90%,80%,${chA})`
            ctx.fillText(ch.char,cx,cy)
            ctx.fillStyle=`hsla(${c.hue},70%,60%,${chA*0.2})`
            ctx.fillText(ch.char,cx-1,cy-1)
          }else{
            ctx.fillStyle=`hsla(${c.hue},70%,${30+chA*40}%,${chA*0.6})`
            ctx.fillText(ch.char,cx,cy)
          }
        }
      }

      // 底部数据辉光
      const dg=ctx.createLinearGradient(0,H*0.85,0,H)
      dg.addColorStop(0,`rgba(0,80,40,${0.02+avgE*0.03+bass*0.02})`)
      dg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=dg;ctx.fillRect(0,H*0.85,W,H*0.15)

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

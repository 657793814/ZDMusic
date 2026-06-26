// 💾 DATA STREAM — 数据流 (v3)
// 歌词雨：歌词从屏幕顶部坠落，像 Matrix 但看到的是中文歌词
import type { PresetModule } from "./types";

const LYRIC_POOL:string[]=[
  "我曾将青春翻涌成她", "指尖弹出盛夏", "心之所动且就随缘去吧",
  "这一路上走走停停", "顺着少年漂流的痕迹", "迈出车站的前一刻",
  "晚风吹起你鬓间的白发", "抚平回忆留下的疤", "你的眼中明暗交杂",
  "终于我找到了你", "就算这世界那么大", "也许我是一道微光",
  "月光洒在每个人心上", "让回家的路有方向",
  "一杯敬朝阳一杯敬月光", "唤醒我的向往温柔了寒窗",
  "夜空中最亮的星", "能否听清", "那仰望的人心底的孤独和叹息",
  "我祈祷拥有一颗透明的心灵", "和会流泪的眼睛",
  "向前跑迎着冷眼和嘲笑", "生命的广阔不经历磨难怎能看到",
  "也许我没有天分", "但我有梦的天真",
  "不怕千万人阻挡", "只怕自己投降",
  "最渺小的我", "有大大的梦",
  "时间会证明一切", "坚持就是胜利",
  "生活不止眼前的苟且", "还有诗和远方的田野",
  "你曾是少年", "你有一双清澈的双眼",
  "我相信我就是我", "我相信明天",
  "逆风的方向更适合飞翔", "我不怕千万人阻挡只怕自己投降",
  "我和我最后的倔强", "握紧双手绝对不放",
  "当我和世界不一样", "那就让我不一样",
  "一生中能有几个十年", "别让遗憾成为永远",
  "我知道我的未来不是梦", "我认真地过每一分钟",
  "我的未来不是梦", "我的心跟着希望在动",
  "没有什么能够阻挡", "我对自由的向往",
  "天马行空的生涯", "你的心了无牵挂",
  "穿过幽暗的岁月", "也曾感到彷徨",
  "好想拥抱你", "在每一个清晨",
  "风吹过的地方", "就有我们的歌",
  "那些你很冒险的梦", "我陪你去疯",
  "因为刚好遇见你", "留下足迹才美丽",
  "和你在一起", "时间都失去意义",
  "你是我最重要的决定", "我愿每天在你身边苏醒",
  "我想大声告诉你", "你一直在我世界里",
  "有一种爱叫做放手", "为爱放弃天长地久",
  "死了都要爱", "不淋漓尽致不痛快",
  "就算全世界都被破坏", "我依然爱你到尽头",
  "你当我是浮夸吧", "夸张只因我很怕",
  "把每天当成是末日来相爱", "一分一秒都美到泪水掉下来",
  "我的爱如潮水", "爱如潮水将我向你推",
  "他明白他明白我给不起", "于是转身向山里走去",
  "原谅我这一生不羁放纵爱自由", "也会怕有一天会跌倒",
  "为你我用了半年的积蓄", "漂洋过海地来看你",
  "陌生的人请给我一支兰州",
  "如果全世界我也可以放弃", "至少还有你值得我去珍惜",
  "后来我总算学会了如何去爱", "可惜你早已远去消失在人海",
  "有些人一旦错过就不再",
]

interface LyricColumn {
  x:number;           // -1..1 水平位置
  lyric:string;       // 当前歌词
  charIdx:number;     // 当前显示的字符索引（连续累加）
  speed:number;       // 下落速度
  hue:number;         // 色相
  phase:number;       // 初始相位
}

const COLS=30
const ra=(a:number,b:number)=>a+Math.random()*(b-a)
const ri=(a:number,b:number)=>Math.floor(ra(a,b+1))

function pickLyric():string{
  return LYRIC_POOL[ri(0,LYRIC_POOL.length-1)]
}
function makeColumn(i:number):LyricColumn{
  return{
    x:(i/COLS)*2-1,lyric:pickLyric(),
    charIdx:ra(0,6),speed:ra(0.018,0.05),
    hue:ri(100,220),phase:ra(0,Math.PI*2),
  }
}

export const preset:PresetModule={
  definition:{id:"data-stream",name:"数据流",icon:"💾",description:"歌词雨"},

  createRenderer(canvas,analyser,playing){
    const ctx=canvas.getContext("2d")!
    let stopped=false,raf:number
    const columns=Array.from({length:COLS},(_,i)=>makeColumn(i))

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

      const speedMul=1+bass*3+mid*1.2
      const fontSize=Math.max(14,SS*0.028)

      // ─── 背景 ───
      ctx.clearRect(0,0,W,H)
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,SS*0.6)
      bg.addColorStop(0,"rgba(2,6,12,1)");bg.addColorStop(0.5,"rgba(3,5,15,1)")
      bg.addColorStop(1,"rgba(2,3,10,1)")
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)

      // ─── 歌词雨 ───
      ctx.textAlign="center";ctx.textBaseline="middle"
      ctx.font=`bold ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`

      for(const col of columns){
        // 字符索引累进（可超过歌词长度，超出就换下一首）
        const advance=speedMul*col.speed
        col.charIdx+=advance

        // 完全落完（最后一个字符也掉出底部后）换新歌词
        const totalChars=col.lyric.length
        // 最后一个字符掉到屏幕底部（索引 = totalChars + 底部偏移量）
        if(col.charIdx>totalChars+15){
          col.lyric=pickLyric()
          col.charIdx=-5   // 从顶外开始
          col.speed=ra(0.018,0.05)
          col.hue=ri(100,240)
        }

        const cx=CX+col.x*W*0.4
        // 每个字符固定 y 间距
        const charSpacing=fontSize*1.2

        for(let ci=0;ci<totalChars;ci++){
          // 这个字符的"创建时帧" = charIdx - ci
          // 它在屏幕上的 y = (创建时帧) * charSpacing
          const birth=col.charIdx-ci
          const y=birth*charSpacing

          // 超出屏幕范围不画
          if(y<-fontSize||y>H+fontSize)continue

          // 亮度：刚出现最亮，往下渐暗
          const life=1-birth/(totalChars+15)
          if(life<0.02)continue

          const ch=col.lyric[ci]
          const hueShift=col.hue+ci*3
          const music=0.5+avgE*0.3+bass*0.2+mid*0.1
          const alpha=life*music*(0.6+0.4*Math.sin(frame*0.02+col.phase+ci*0.3))
          if(alpha<0.02)continue

          // 最新出现的几个字符最亮 + 发光
          if(ci===Math.floor(col.charIdx)){
            ctx.shadowColor=`hsla(${hueShift+20},90%,70%,${alpha*0.5})`
            ctx.shadowBlur=6*(1+bass*2)
            ctx.fillStyle=`hsla(${hueShift+20},100%,85%,${alpha})`
          }else{
            ctx.shadowBlur=0
            const dim=life
            const lt=25+alpha*35
            ctx.fillStyle=`hsla(${hueShift},70%,${lt}%,${alpha*dim})`
          }

          ctx.fillText(ch,cx,y)
          ctx.shadowBlur=0
        }
      }

      // ─── 底部辉光 ───
      const dg=ctx.createLinearGradient(0,H*0.85,0,H)
      dg.addColorStop(0,`rgba(0,60,80,${0.02+avgE*0.03})`)
      dg.addColorStop(1,"rgba(0,0,0,0)")
      ctx.fillStyle=dg;ctx.fillRect(0,H*0.85,W,H*0.15)

      // --- 能量柱 ---
      if(analyser&&playing&&freq.length>0){
        const step=Math.max(1,Math.floor(freq.length/48)),maxH=H*0.05,bw=3,gap=1,tw=48*(bw+gap),sx=(W-tw)/2
        for(let i=0;i<48;i++){let s=0;const st=i*step,en=Math.min(st+step,freq.length);for(let j=st;j<en;j++)s+=freq[j];const n=s/(en-st)/255,bh=Math.max(1,n*maxH),y=H-bh;ctx.fillStyle=`hsla(${220+n*80},70%,${40+n*30}%,${0.08+n*0.12})`;ctx.fillRect(sx+i*(bw+gap),y,bw,bh)}
      }
    }
    draw()
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener("resize",resize)}
  },
}

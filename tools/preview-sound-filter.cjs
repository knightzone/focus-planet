// 声音过滤器（听类型、点气泡）的浏览器近似预览：直接跑真实页面模板与脚本，仅用于视觉与手感检查。
// 用法：node tools/preview-sound-filter.cjs
//   http://127.0.0.1:4181/                     规则卡（点“开始”进入）
//   http://127.0.0.1:4181/?start=1&level=6     直接开始并指定难度（排数 = 难度）
//   http://127.0.0.1:4181/?start=1&auto=1      自动点对（跑完整局）用来目检波次切换
//   http://127.0.0.1:4181/?debug=1             打印气泡实际尺寸与位置，复核小屏（配合 ?w=&h=）
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const vue = process.env.VUE_BROWSER_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue/dist/vue.global.js'
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const strip = (text) => text.replace(/^import[\s\S]*?from\s*'[^']*';?/gm, '').replace(/^export /gm, '')

function render(url) {
  const level = [1, 2, 3, 5, 7, 10].includes(Number(url.searchParams.get('level'))) ? Number(url.searchParams.get('level')) : 1
  const start = url.searchParams.get('start') == '1'
  const auto = url.searchParams.get('auto') == '1'
  const debug = url.searchParams.get('debug') == '1'
  const width = Number(url.searchParams.get('w')) > 0 ? Number(url.searchParams.get('w')) : 390
  const height = Number(url.searchParams.get('h')) > 0 ? Number(url.searchParams.get('h')) : 844
  const topInset = height < 700 ? 20 : 47
  const page = read('pages/game/sound-filter.uvue')
  const script = strip(page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1])
  const ast = ts.createSourceFile('p.ts', script, ts.ScriptTarget.Latest, true), names = []
  for (const node of ast.statements) {
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) names.push(declaration.name.getText(ast))
    if (ts.isFunctionDeclaration(node)) names.push(node.name.text)
  }
  const template = page.slice(page.indexOf('<template>') + 10, page.lastIndexOf('</template>'))
    .replace(/<(\/?)view\b/g, '<$1div')
    .replace(/<(\/?)text\b/g, '<$1span')
    .replace(/<image\b/g, '<img').replace(/<\/image>/g, '')
    .replace(/<TrainingFrame[^>]*>/, `<div class="frame"><div class="training-status" style="height:${topInset}px"></div><div class="nav">‹　声音过滤器</div>`)
    .replace('</TrainingFrame>', '</div>')
  const common = strip(read('utils/sound-filter.uts')) + '\n' + strip(read('utils/sound-filter-voice.uts'))
  const autoScript = auto ? `setInterval(()=>{
    if(!started.value||field==null) return;
    for(const bubble of field.bubbles) if(bubble.isTarget&&!bubble.tapped&&!bubble.escaped) tapBubble(bubble.id);
  },40);` : ''
  const boot = `const {ref,computed,nextTick,watch,onUnmounted}=Vue;
const onLoad=(fn)=>fn({}),onUnload=(fn)=>onUnmounted(fn),onResize=(fn)=>window.addEventListener('resize',fn);
const getGameDifficulty=()=>${level};
const getGameTuningAge=()=>10;
const averageRoundScore=(scores,maximum)=>scores.length==0?0:Math.floor(scores.reduce((a,b)=>a+Math.min(maximum,b),0)/scores.length+1e-6);
const scoreQuery=(scores)=>'&scoreVersion=goal-v2&roundScores='+scores.join(',');
const uni={getWindowInfo:()=>({windowWidth:${width},windowHeight:${height},statusBarHeight:${topInset},pixelRatio:3}),
  getElementById:(id)=>document.getElementById(id),
  getStorageSync:()=>'',setStorageSync(){},removeStorageSync(){},
  // Visual preview only: simulate narration ending, without playing audio.
  createInnerAudioContext:()=>({src:'',timer:0,ended(){},onEnded(f){this.ended=f},onError(){},play(){this.timer=setTimeout(()=>this.ended(),500)},stop(){clearTimeout(this.timer)},pause(){clearTimeout(this.timer)},destroy(){clearTimeout(this.timer)}}),
  redirectTo(o){document.querySelector('.nav').textContent='完成！总分 '+o.url.split('&score=')[1].split('&')[0]+' 分'}};
${ts.transpile(common, { target: ts.ScriptTarget.ES2020 })}
function useTrainingSession(){const timers=[];const clock={now:()=>Date.now(),setTimeout:(f,ms)=>{const id=setTimeout(f,ms);timers.push(id);return id},clearTimeout:(id)=>clearTimeout(id),clearInterval:(id)=>clearInterval(id),setInterval:(f,ms)=>{const id=setInterval(f,ms);timers.push(id);return id},dispose:()=>timers.forEach(clearTimeout),createAudio:()=>uni.createInnerAudioContext(),destroyAudio(){}};onUnmounted(()=>clock.dispose());return{clock,paused:ref(false),navigating:ref(false),setStartedCheck(){},playFeedback(){},pause(){},resume(){},restart(){},exit(){},back(){}}}
const app=Vue.createApp({setup(){
${ts.transpile(script, { target: ts.ScriptTarget.ES2020 })}
${start ? 'setTimeout(()=>begin(),80);' : ''}
${autoScript}
${debug ? `setTimeout(()=>{const lines=['innerWidth='+window.innerWidth+' innerHeight='+window.innerHeight,'场地='+fieldWidth.value+'x'+fieldHeight.value+' 排数='+level.value+' 波数='+totalWaves.value];for(const selector of ['.frame','.sf-page','.sf-header','.sf-callout','.sf-field','.sf-bubble','.sf-mark','.sf-stats','.sf-intro']){const element=document.querySelector(selector);if(!element){lines.push(selector+' MISSING');continue}const rect=element.getBoundingClientRect();lines.push(selector+' xy='+Math.round(rect.x)+','+Math.round(rect.y)+' '+Math.round(rect.width)+'x'+Math.round(rect.height))}showBootError(lines.join(String.fromCharCode(10)))},900);` : ''}
return {${names.join(',')}}
}});
app.config.errorHandler=(error,instance,info)=>showBootError('render: '+info+String.fromCharCode(10)+(error&&error.stack?error.stack:error));
app.config.warnHandler=(message)=>showBootError('warn: '+message);
app.mount('#app');`
  const errorOverlay = `<script>function showBootError(text){const pre=document.createElement('pre');pre.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:45%;overflow:auto;background:#fff;color:#c00;font-size:11px;z-index:9';pre.textContent=text;document.body.appendChild(pre)}window.onerror=(message,source,line,column,error)=>showBootError(message+' @'+line+':'+column+String.fromCharCode(10)+(error&&error.stack?error.stack:''))</script>`
  const chrome = `*{box-sizing:border-box}body{margin:0;background:#dfe7ee;font-family:Arial}#app{width:${width}px;max-width:${width}px;height:${height}px;margin:auto}div{display:flex;flex-direction:column;min-width:0}span{display:block}img{object-fit:contain;flex-shrink:0}button{border:0;flex-shrink:0}.frame{height:100%}.nav{height:44px;flex-shrink:0;background:#f3f0fb;padding:10px 16px;color:#4a3b86}.sf-scene{object-fit:cover}`
  return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>声音过滤器预览</title><style>' + chrome + page.match(/<style>([\s\S]*?)<\/style>/)[1] + '</style><div id="app">' + template + '</div>' + errorOverlay + '<script src="/vue.js"></script><script>' + boot + '</script>'
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname == '/') {
    res.setHeader('Content-Type', 'text/html;charset=utf-8')
    res.end(render(url))
    return
  }
  const file = url.pathname == '/vue.js' ? vue : path.resolve(root, '.' + url.pathname)
  if (url.pathname != '/vue.js' && (!url.pathname.startsWith('/static/') || !file.startsWith(root + path.sep))) {
    res.writeHead(404); res.end(); return
  }
  try {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.webp') ? 'image/webp' : 'application/octet-stream')
    res.end(fs.readFileSync(file))
  } catch { res.writeHead(404); res.end() }
}).listen(4181, '127.0.0.1', () => console.log('http://127.0.0.1:4181/?start=1&level=6'))

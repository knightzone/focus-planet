// 魔法规则 / 奇偶轨道 的浏览器近似试玩：直接跑真实页面模板与脚本，仅用于视觉检查，不写账号或成绩。
// 用法：node tools/preview-switch-rules.cjs
//   http://127.0.0.1:4180/?game=magic-rule     试玩页（含“先试一下”演示）
//   http://127.0.0.1:4180/?game=number-track&start=1&level=3   跳过演示，直接进入第 3 档
//   http://127.0.0.1:4180/?game=magic-rule&start=1&auto=1      自动答题跑完整局
//   http://127.0.0.1:4180/?game=number-track&debug=1           打印关键元素尺寸与底色
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const vue = process.env.VUE_BROWSER_PATH || '/Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue/dist/vue.global.js'
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const GAMES = { 'magic-rule': '魔法规则', 'number-track': '奇偶轨道' }

function render(url) {
  const game = Object.prototype.hasOwnProperty.call(GAMES, url.searchParams.get('game')) ? url.searchParams.get('game') : 'magic-rule'
  const title = GAMES[game]
  const prefix = game == 'magic-rule' ? 'mr' : 'nt'
  const level = Math.max(1, Math.min(10, Number(url.searchParams.get('level')) > 0 ? Number(url.searchParams.get('level')) : 1))
  const start = url.searchParams.get('start') == '1'
  const auto = url.searchParams.get('auto') == '1'
  const debug = url.searchParams.get('debug') == '1'
  const width = Number(url.searchParams.get('w')) > 0 ? Number(url.searchParams.get('w')) : 390
  const height = Number(url.searchParams.get('h')) > 0 ? Number(url.searchParams.get('h')) : 844
  const page = read('pages/game/' + game + '.uvue')
  const script = page.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
  const ast = ts.createSourceFile('p.ts', script, ts.ScriptTarget.Latest, true), names = []
  for (const node of ast.statements) {
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) names.push(declaration.name.getText(ast))
    if (ts.isFunctionDeclaration(node)) names.push(node.name.text)
  }
  const template = page.slice(page.indexOf('<template>') + 10, page.lastIndexOf('</template>'))
    .replace(/<(\/?)view\b/g, '<$1div')
    .replace(/<(\/?)text\b/g, '<$1span')
    .replace(/<image\b/g, '<img').replace(/<\/image>/g, '')
    .replace(/<TrainingFrame[^>]*>/, '<div class="frame"><div class="nav">‹　' + title + '</div>')
    .replace('</TrainingFrame>', '</div>')
  const common = ['game-scoring'].map(name => read('utils/' + name + '.uts').replace(/^import .*$/gm, '').replace(/^export /gm, '')).join('\n')
  const autoBody = game == 'magic-rule'
    ? `setInterval(()=>{if(!started.value){if(demoDone.value)begin();else answerDemo(demoStep.value===0?'left':'right');return}if(feedback.value=='')answer(correctSide())},220);`
    : `setInterval(()=>{if(!started.value){if(demoDone.value)begin();else answerDemo(demoStep.value===0?'left':'right');return}if(accepting.value===false)return;if(feedback.value=='')answer(expected())},220);`
  const debugSelectors = ['#app', '.frame', '.' + prefix + '-page', '.' + prefix + '-content', '.' + prefix + '-header', '.' + prefix + '-rule-card', '.' + prefix + '-stage', '.' + prefix + '-stim', '.' + prefix + '-number', '.' + prefix + '-answer', '.' + prefix + '-track', '.' + prefix + '-stats', '.' + prefix + '-start']
  const boot = `const {ref,computed,onUnmounted}=Vue;
const onLoad=f=>f({}),onUnload=f=>onUnmounted(f);
const getGameDifficulty=()=>${level};
const getGameTuningAge=()=>${level + 4};
const uni={getWindowInfo:()=>({windowWidth:${width},windowHeight:${height},statusBarHeight:${height < 700 ? 20 : 47},pixelRatio:3}),getStorageSync:()=>null,setStorageSync(){},removeStorageSync(){},redirectTo(o){document.querySelector('.nav').textContent='完成 '+o.url.split('&score=')[1].split('&')[0]+'分'}};
${ts.transpile(common, { target: ts.ScriptTarget.ES2020 })}
function useTrainingSession(){const timers=[];const clock={now:()=>Date.now(),setTimeout:(f,ms)=>{const id=setTimeout(f,ms);timers.push(id);return id},clearTimeout:id=>clearTimeout(id),clearInterval:id=>clearInterval(id),setInterval:(f,ms)=>{const id=setInterval(f,ms);timers.push(id);return id},dispose:()=>timers.forEach(clearTimeout)};onUnmounted(()=>clock.dispose());return{clock,paused:ref(false),navigating:ref(false),setStartedCheck(){},playFeedback(){},pause(){},resume(){},restart(){},exit(){},back(){}}}
const app=Vue.createApp({setup(){
${ts.transpile(script, { target: ts.ScriptTarget.ES2020 })}
${start ? 'setTimeout(()=>begin(),60);' : ''}
${auto ? autoBody : ''}
return {${names.join(',')}}
}});
for(const name of ['ActionSurface','Actionsurface'])app.component(name, Vue.defineComponent({ name, template: '<div><slot /></div>' }));
app.config.errorHandler=(error,instance,info)=>showBootError('render: '+info+String.fromCharCode(10)+(error&&error.stack?error.stack:error));
app.config.warnHandler=(message)=>showBootError('warn: '+message);
app.mount('#app');
${debug ? `setTimeout(()=>{const lines=['innerWidth='+window.innerWidth+' innerHeight='+window.innerHeight];for(const selector of ${JSON.stringify(debugSelectors)}){const element=document.querySelector(selector);if(!element){lines.push(selector+' MISSING');continue}const rect=element.getBoundingClientRect(),style=getComputedStyle(element);lines.push(selector+' '+Math.round(rect.width)+'x'+Math.round(rect.height)+' y='+Math.round(rect.top)+' bg='+style.backgroundColor)}showBootError(lines.join(String.fromCharCode(10)))},800);` : ''}`
  const errorOverlay = `<script>function showBootError(text){const pre=document.createElement('pre');pre.id='boot-error';pre.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:45%;overflow:auto;background:#fff;color:#c00;font-size:11px;z-index:9';pre.textContent=text;document.body.appendChild(pre)}window.onerror=(message,source,line,column,error)=>showBootError(message+' @'+line+':'+column+String.fromCharCode(10)+(error&&error.stack?error.stack:''))</script>`
  return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '预览</title><style>*{box-sizing:border-box}body{margin:0;background:#dfe7ee;font-family:Arial}#app{width:' + width + 'px;max-width:' + width + 'px;height:' + height + 'px;margin:auto}div{display:flex;flex-direction:column;min-width:0}span{display:block}img{object-fit:contain;flex-shrink:0}button{border:0;flex-shrink:0}.tap-content{pointer-events:none}.frame{height:100%}.nav{height:54px;flex-shrink:0;background:#f5f8fc;padding:16px;color:#33415b}.mr-scene,.nt-scene{object-fit:cover}' + page.match(/<style>([\s\S]*?)<\/style>/)[1] + '</style><div id="app">' + template + '</div>' + errorOverlay + '<script src="/vue.js"></script><script>' + boot + '</script>'
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
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.webp') ? 'image/webp' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream')
    res.end(fs.readFileSync(file))
  } catch { res.writeHead(404); res.end() }
}).listen(4180, '127.0.0.1', () => console.log('试玩页 http://127.0.0.1:4180/?game=magic-rule　或　?game=number-track'))

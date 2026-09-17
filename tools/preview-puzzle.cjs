// 拼图工坊的浏览器近似预览：直接跑真实页面模板与脚本，仅用于视觉与交互检查，不写账号或成绩。
// 用法：node tools/preview-puzzle.cjs
//   http://127.0.0.1:4178/                          试玩（2×2，拖动/点选都能用）
//   http://127.0.0.1:4178/?start=1&level=10          第 10 档（5×6，30 块）
//   http://127.0.0.1:4178/?solve=1                   自动把所有拼块放回原位（验证裁切是否拼成整图）
//   http://127.0.0.1:4178/?debug=1                   打印棋盘/格子/托盘的实际尺寸与页面算出的几何值
//   http://127.0.0.1:4178/?w=375&h=667               复核小屏
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const vue = process.env.VUE_BROWSER_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue/dist/vue.global.js'
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const strip = text => text.replace(/^import .*$/gm, '').replace(/^export /gm, '')

// 顺序有依赖：scenes 在模块初始化时读 STORY_DIFFERENCE_SCENES。
const COMMON = ['training-clock', 'local-test', 'spot-difference-types', 'spot-difference-story', 'spot-difference-scenes', 'puzzle', 'puzzle-cycle', 'game-scoring']

function render(url) {
  const level = [1, 3, 5, 7, 10].includes(Number(url.searchParams.get('level'))) ? Number(url.searchParams.get('level')) : 1
  const start = url.searchParams.get('start') == '1'
  const debug = url.searchParams.get('debug') == '1'
  const solve = url.searchParams.get('solve') == '1'
  const width = Number(url.searchParams.get('w')) > 0 ? Number(url.searchParams.get('w')) : 390
  const height = Number(url.searchParams.get('h')) > 0 ? Number(url.searchParams.get('h')) : 844
  const topInset = height < 700 ? 20 : 47
  const page = read('pages/game/puzzle.uvue')
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
    // 真机里 TrainingFrame 是「状态栏 + 44px 工具条」，预览也照这个几何搭，落点判定才对得上。
    .replace(/<TrainingFrame[^>]*>/, '<div class="frame"><div class="training-status" style="height:' + topInset + 'px"></div><div class="nav">‹　拼图工坊</div>')
    .replace('</TrainingFrame>', '</div>')
  const common = COMMON.map(name => strip(read('utils/' + name + '.uts'))).join('\n')
  const probe = debug ? `setTimeout(()=>{
    const lines=['innerWidth='+window.innerWidth+' innerHeight='+window.innerHeight];
    lines.push('页面算出：boardTop='+boardTopLocal()+' trayTop='+trayTopLocal()+' board='+boardW.value+'x'+boardH.value+' slot='+slotW.value.toFixed(1)+'x'+slotH.value.toFixed(1)+' cellW='+cellW.value+' 格子数='+count.value);
    for (const selector of ['.frame','.content','.mission-card','.board','.slot','.piece-box','.piece-img','.tray','.tray-cell','.stats']) {
      const element=document.querySelector(selector); if(!element){lines.push(selector+' MISSING');continue}
      const rect=element.getBoundingClientRect(), style=getComputedStyle(element);
      lines.push(selector+' xy='+Math.round(rect.x)+','+Math.round(rect.y)+' '+Math.round(rect.width)+'x'+Math.round(rect.height)+' overflow='+style.overflow+' pos='+style.position+' left='+style.left+' top='+style.top);
    }
    showBootError(lines.join(String.fromCharCode(10)));},900);` : ''
  const autoSolve = solve ? `setTimeout(()=>{
    const before=JSON.stringify(slots.value);
    for(let i=0;i<count.value;i++){ if(tray.value.indexOf(i)>=0) placeFromTray(i,i) }
    showBootError('solve: placed='+placedCount.value+'/'+count.value+' solved='+puzzleSolved(slots.value)+' tray='+tray.value.length+' mistakes='+mistakes.value+String.fromCharCode(10)+'board='+boardW.value+'x'+boardH.value+' slot='+slotW.value.toFixed(2)+'x'+slotH.value.toFixed(2)+String.fromCharCode(10)+'第0块裁切: left='+cropLeft(0,slotW.value)+' top='+cropTop(0,slotH.value)+' w='+cropWidth(slotW.value)+' h='+cropHeight(slotH.value)+String.fromCharCode(10)+'末块裁切: left='+cropLeft(count.value-1,slotW.value)+' top='+cropTop(count.value-1,slotH.value)+String.fromCharCode(10)+'changed='+(JSON.stringify(slots.value)!=before));},700);` : ''
  const boot = `const {ref,computed,watch,onUnmounted,nextTick}=Vue;
const onLoad=f=>f({}),onUnload=f=>onUnmounted(f),onResize=f=>{};
const getGameDifficulty=()=>${level};
const storage={};
const uni={getWindowInfo:()=>({windowWidth:${width},windowHeight:${height},statusBarHeight:${topInset},pixelRatio:3}),getStorageSync:k=>storage[k]===undefined?'':storage[k],setStorageSync:(k,v)=>{storage[k]=v},removeStorageSync:k=>{delete storage[k]},redirectTo(o){document.title='result:'+o.url}};
${ts.transpile(common, { target: ts.ScriptTarget.ES2020 })}
function useTrainingSession(){const clock=new TrainingClock();onUnmounted(()=>clock.dispose());return{clock,paused:ref(false),navigating:ref(false),setStartedCheck(){},playFeedback(){},pause(){},resume(){},restart(){},exit(){},back(){}}}
const app=Vue.createApp({setup(){
${ts.transpile(script, { target: ts.ScriptTarget.ES2020 })}
${start ? 'setTimeout(()=>begin(),60);' : ''}
${autoSolve}
${probe}
return {${names.join(',')}}
}});
app.config.errorHandler=(error,instance,info)=>showBootError('render: '+info+String.fromCharCode(10)+(error&&error.stack?error.stack:error));
app.config.warnHandler=(message)=>showBootError('warn: '+message);
app.mount('#app');`
  const errorOverlay = `<script>function showBootError(text){const pre=document.createElement('pre');pre.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:52%;overflow:auto;background:#fff;color:#c00;font-size:11px;z-index:9';pre.textContent=text;document.body.appendChild(pre)}window.onerror=(message,source,line,column,error)=>showBootError(message+' @'+line+':'+column+String.fromCharCode(10)+(error&&error.stack?error.stack:''))</script>`
  // 真机 mode="scaleToFill" 等于拉伸填满，预览里用 object-fit:fill 对齐这个语义。
  const chrome = '*{box-sizing:border-box}body{margin:0;background:#dfe7ee;font-family:Arial}#app{width:' + width + 'px;max-width:' + width + 'px;height:' + height + 'px;margin:auto}div{display:flex;flex-direction:column;min-width:0}span{display:block}img{object-fit:fill;flex-shrink:0}button{border:0;flex-shrink:0}.frame{height:100%}.nav{height:44px;flex-shrink:0;background:#f5f8fc;padding:10px 16px;color:#33415b}.scene{object-fit:cover}'
  return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>拼图工坊预览</title><style>' + chrome + page.match(/<style>([\s\S]*?)<\/style>/)[1] + '</style><div id="app">' + template + '</div>' + errorOverlay + '<script src="/vue.js"></script><script>' + boot + '</script>'
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
}).listen(4178, '127.0.0.1', () => console.log('http://127.0.0.1:4178/?start=1&level=10'))

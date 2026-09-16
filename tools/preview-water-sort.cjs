// 倒水小实验的浏览器近似预览：直接跑真实页面模板与脚本，仅用于视觉检查，不写账号或成绩。
// 用法：node tools/preview-water-sort.cjs
//   http://127.0.0.1:4177/            试玩页
//   http://127.0.0.1:4177/?start=1&level=1   直接进入第 1 档正式训练
//   http://127.0.0.1:4177/?start=1&level=10  第 10 档（8 根试管）
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root = path.resolve(__dirname, '..')
const vue = process.env.VUE_BROWSER_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue/dist/vue.global.js'
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function render(url) {
  const level = [1, 3, 5, 7, 10].includes(Number(url.searchParams.get('level'))) ? Number(url.searchParams.get('level')) : 1
  const start = url.searchParams.get('start') == '1'
  const debug = url.searchParams.get('debug') == '1'
  const auto = url.searchParams.get('auto') == '1'
  // 真机尺寸可用 ?w=&h= 覆盖，用来复核小屏（例如 375×667）是否溢出。
  const width = Number(url.searchParams.get('w')) > 0 ? Number(url.searchParams.get('w')) : 390
  const height = Number(url.searchParams.get('h')) > 0 ? Number(url.searchParams.get('h')) : 844
  const page = read('pages/game/water-sort.uvue')
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
    .replace(/<TrainingFrame[^>]*>/, '<div class="frame"><div class="nav">‹　倒水小实验</div>')
    .replace('</TrainingFrame>', '</div>')
  const common = ['training-clock', 'water-sort-levels', 'water-sort', 'game-scoring'].map(name => read('utils/' + name + '.uts').replace(/^import .*$/gm, '').replace(/^export /gm, '')).join('\n')
  const boot = `const {ref,computed,watch,onUnmounted}=Vue;
const onLoad=f=>f({}),onUnload=f=>onUnmounted(f);
const getGameDifficulty=()=>${level};
const uni={getWindowInfo:()=>({windowWidth:${width},windowHeight:${height},statusBarHeight:${height < 700 ? 20 : 47},pixelRatio:3}),getStorageSync:()=>null,setStorageSync(){},redirectTo(o){document.title='result:'+o.url}};
${ts.transpile(common, { target: ts.ScriptTarget.ES2020 })}
function useTrainingSession(){const clock=new TrainingClock();onUnmounted(()=>clock.dispose());return{clock,paused:ref(false),navigating:ref(false),setStartedCheck(){},playFeedback(){},pause(){},resume(){},restart(){},exit(){},back(){}}}
const app=Vue.createApp({setup(){
${ts.transpile(script, { target: ts.ScriptTarget.ES2020 })}
${start ? 'setTimeout(()=>begin(),60);' : ''}
${auto ? `setTimeout(()=>{const before=JSON.stringify(tubes.value);let picked=0;for(let from=0;from<tubes.value.length&&picked<1;from++){for(let to=0;to<tubes.value.length&&picked<1;to++){if(from==to)continue;if(waterSortPour(tubes.value,from,to).ok){tapTube(from);tapTube(to);picked=1}}}showBootError('auto: found='+picked+' moves='+moveCount.value+' selected='+selected.value+' feedback='+feedback.value+' changed='+(JSON.stringify(tubes.value)!=before)+String.fromCharCode(10)+'tubes='+JSON.stringify(tubes.value))},600);` : ''}
return {${names.join(',')}}
}});
app.config.errorHandler=(error,instance,info)=>showBootError('render: '+info+String.fromCharCode(10)+(error&&error.stack?error.stack:error));
app.config.warnHandler=(message)=>showBootError('warn: '+message);
app.mount('#app');
${debug ? `setTimeout(()=>{const lines=['innerWidth='+window.innerWidth+' innerHeight='+window.innerHeight+' dpr='+window.devicePixelRatio];for(const selector of ['.frame','.content','.header','.counter','.instruction','.demo-lab','.tube-wrap','.tube','.slot','.lab','.mission-card','.stats']){const element=document.querySelector(selector);if(!element){lines.push(selector+' MISSING');continue}const rect=element.getBoundingClientRect(),style=getComputedStyle(element);lines.push(selector+' xy='+Math.round(rect.x)+','+Math.round(rect.y)+' '+Math.round(rect.width)+'x'+Math.round(rect.height)+' computed='+style.width+','+style.height+' bg='+style.backgroundColor+' border='+style.borderBottomWidth+' radius='+style.borderBottomLeftRadius);}showBootError(lines.join(String.fromCharCode(10)))},700);` : ''}`
  const errorOverlay = `<script>function showBootError(text){const pre=document.createElement('pre');pre.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:45%;overflow:auto;background:#fff;color:#c00;font-size:11px;z-index:9';pre.textContent=text;document.body.appendChild(pre)}window.onerror=(message,source,line,column,error)=>showBootError(message+' @'+line+':'+column+String.fromCharCode(10)+(error&&error.stack?error.stack:''))</script>`
  return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>倒水小实验预览</title><style>*{box-sizing:border-box}body{margin:0;background:#dfe7ee;font-family:Arial}#app{width:' + width + 'px;max-width:' + width + 'px;height:' + height + 'px;margin:auto}div{display:flex;flex-direction:column;min-width:0}span{display:block}img{object-fit:contain;flex-shrink:0}button{border:0;flex-shrink:0}.tap-content{pointer-events:none}.frame{height:100%}.nav{height:54px;flex-shrink:0;background:#f5f8fc;padding:16px;color:#33415b}.scene{object-fit:cover}' + page.match(/<style>([\s\S]*?)<\/style>/)[1] + '</style><div id="app">' + template + '</div>' + errorOverlay + '<script src="/vue.js"></script><script>' + boot + '</script>'
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
}).listen(4177, '127.0.0.1', () => console.log('http://127.0.0.1:4177/?start=1&level=1'))

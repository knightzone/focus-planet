// 本地浏览器视觉检查；直接使用 .uvue 模板、样式与游戏逻辑，不替代原生编译。
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const ts = require(process.env.TYPESCRIPT_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
const game = ['bird-cloud','audio-sequence','breathing-planet'].includes(process.env.PREVIEW_GAME) ? process.env.PREVIEW_GAME : 'car-patrol';
const vue = process.env.VUE_BROWSER_PATH || '/Applications/HBuilderX-Alpha.app/Contents/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue/dist/vue.global.js';
function html() {
  const file = fs.readFileSync(path.join(root, 'pages/game/' + game + '.uvue'), 'utf8');
  const template = file.match(/<template>([\s\S]*?)<\/template>/)[1].replace(/<(\/?)view\b/g, '<$1div').replace(/<(\/?)text\b/g, '<$1span').replace(/<image\b/g, '<img').replace(/<\/image>/g, '');
  const source = file.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '');
  const logic = fs.readFileSync(path.join(root, 'utils/' + (game === 'audio-sequence' ? 'audio-match' : game) + '.uts'), 'utf8').replace(/^export /gm, '');
  const ast = ts.createSourceFile('page.ts', source, ts.ScriptTarget.Latest, true), names = [];
  for (const statement of ast.statements) {
    if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) names.push(d.name.getText(ast));
    if (ts.isFunctionDeclaration(statement)) names.push(statement.name.text);
  }
  const js = ts.transpile(logic + '\n' + source + '\nreturn {' + names.join(',') + '}', {target: ts.ScriptTarget.ES2020});
  const css = file.match(/<style>([\s\S]*?)<\/style>/)[1] + '.cloud-background{object-fit:cover}';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>小车巡逻 · 本地视觉检查</title><style>*{box-sizing:border-box}body{margin:0;background:#dae5e6;font-family:Arial,sans-serif}#app{max-width:430px;height:100dvh;margin:auto;display:flex;flex-direction:column}div{display:flex;flex-direction:column;min-width:0}button{border:0;cursor:pointer}img{object-fit:contain}.scene-art{object-fit:fill}.tap-content{pointer-events:none}.navigation{height:54px;flex-shrink:0;justify-content:center;align-items:center;background:#f1f7f7;color:#27414e;font-size:18px}span{display:block}${css}</style></head><body><div id="app"><div class="navigation">小车巡逻</div>${template}</div><script src="/vue.js"></script><script>const {ref,computed,nextTick,watch}=Vue;const onReady=f=>nextTick(f);const onResize=()=>{};const onLoad=f=>f();const onHide=()=>{};const onUnload=()=>{};const getGameDifficulty=()=>Number(new URLSearchParams(location.search).get('level')||1);const uni={getElementById:id=>document.getElementById(id),redirectTo:o=>{document.querySelector('.control-hint').textContent='完成！'+o.url.split('&score=')[1].split('&')[0]+'分'},navigateBack:()=>location.reload()};Vue.createApp({setup(){${js}}}).mount('#app');</script></body></html>`;
}
function withTrainingFrame(result) {
  const frame = fs.readFileSync(path.join(root, 'components/TrainingFrame.uvue'), 'utf8');
  const template = frame.match(/<template>([\s\S]*?)<\/template>/)[1].replace(/<(\/?)view\b/g, '<$1div').replace(/<(\/?)text\b/g, '<$1span').replace(/<image\b/g, '<img').replace(/<\/image>/g, '');
  const common = ['game-scoring', 'training-clock', 'training-session', 'training-tween'].map(name => fs.readFileSync(path.join(root, 'utils/' + name + '.uts'), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '')).join('\n');
  const prelude = 'const onBackPress=()=>{};const getCurrentPages=()=>[{route:"pages/game/' + game + '",options:{level:new URLSearchParams(location.search).get("level")||"1"}}];' + ts.transpile(common, {target:ts.ScriptTarget.ES2020}) + 'uni.redirectTo=o=>{if(o.url.includes("/result?")){document.querySelector(".stat,.control-hint,.feedback").textContent="训练完成"}else location.reload()};uni.switchTab=()=>location.reload();uni.showToast=o=>alert(o.title);';
  const audioShim = "uni.createInnerAudioContext=()=>{const a=new Audio();return {set src(v){a.src=v},set volume(v){a.volume=v},get paused(){return a.paused},play(){a.play().catch(()=>{})},pause(){a.pause()},stop(){a.pause();a.currentTime=0},destroy(){a.pause();a.removeAttribute('src')},onPlay(f){a.addEventListener('play',f)},onEnded(f){a.addEventListener('ended',f)},onError(f){a.addEventListener('error',f)}}};";
  return result.replace(/<div class="navigation">[^<]*<\/div>/, '').replace(/<(\/?)scroll-view\b/g,'<$1div').replaceAll('TrainingFrame ', 'training-frame ').replaceAll('</TrainingFrame>', '</training-frame>').replace('</style>', frame.match(/<style>([\s\S]*?)<\/style>/)[1] + '.night,.sky{object-fit:cover}.cover{object-fit:cover;flex-shrink:0}.scroll{min-height:0;overflow-y:auto}.training-frame,.training-game,.page{min-height:0}</style>')
    .replace('Vue.createApp', prelude + audioShim + 'Vue.createApp')
    .replace("}).mount('#app')", "}).component('TrainingFrame',{props:['paused','busy','title'],template:" + JSON.stringify(template) + ",setup(props,{emit}){return {emit,topInset:0,ignore(){}}}}).mount('#app')");
}
http.createServer((req,res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    const result = withTrainingFrame(html());
    res.end(game === 'car-patrol' ? result : result.replaceAll('小车巡逻', game === 'bird-cloud' ? '小鸟穿云' : game === 'breathing-planet' ? '呼吸小星球' : '听音节奏').replaceAll('.control-hint', '.stat'));
    return;
  }
  const file = pathname === '/vue.js' ? vue : path.resolve(root, '.' + pathname);
  if (pathname !== '/vue.js' && (!pathname.startsWith('/static/') || !file.startsWith(root + path.sep))) {res.writeHead(404); res.end(); return;}
  try {res.setHeader('Content-Type', file.endsWith('.mp3') ? 'audio/mpeg' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.js') ? 'application/javascript' : 'image/webp'); res.end(fs.readFileSync(file));} catch {res.writeHead(404);res.end();}
}).listen(4173,'127.0.0.1',()=>console.log('Car patrol preview: http://127.0.0.1:4173/?level=1'));

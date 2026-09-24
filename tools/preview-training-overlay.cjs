// Actual shared component template/CSS, browser-only interaction check.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http')
const root=path.resolve(__dirname,'..')
const vue='/Applications/HBuilderX.app/Contents/HBuilderX/plugins/uniapp-cli-vite/node_modules/vue/dist/vue.global.js'
http.createServer((req,res)=>{
 if(req.url==='/vue.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(vue));return}
 if(req.url.startsWith('/static/')){const p=path.resolve(root,'.'+req.url);if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return}try{res.end(fs.readFileSync(p))}catch{res.writeHead(404);res.end()}return}
 const s=fs.readFileSync(path.join(root,'components/TrainingFrame.uvue'),'utf8')
 const tpl=s.match(/<template>([\s\S]*?)<\/template>/)[1].replace(/<(\/?)view\b/g,'<$1div').replace(/<(\/?)text\b/g,'<$1span').replace(/<image\b/g,'<img').replace(/<\/image>/g,'').replace('<slot></slot>','<div class="demo-game">训练画面<button @click="emit(\'pause\')">打开退出弹层</button></div>')
 res.setHeader('Content-Type','text/html;charset=utf-8')
 res.end('<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#dce5ef;font-family:Arial}#app{width:390px;height:720px;margin:auto;display:flex}div{display:flex;flex-direction:column}span{display:block}button{flex-shrink:0}img{object-fit:contain}.demo-game{flex:1;background:#c9e7f4;align-items:center;justify-content:center}'+s.match(/<style>([\s\S]*?)<\/style>/)[1]+'</style><div id="app">'+tpl+'</div><script src="/vue.js"></script><script>Vue.createApp({setup(){const paused=Vue.ref(true),busy=Vue.ref(false);return{paused,busy,title:"找茬乐园",preparing:false,difficulty:1,topInset:20,ignore(){},emit(action){if(action==="pause"||action==="back")paused.value=true;else paused.value=false}}}}).mount("#app")</script>')
}).listen(4194,'127.0.0.1',()=>console.log('http://127.0.0.1:4194'))

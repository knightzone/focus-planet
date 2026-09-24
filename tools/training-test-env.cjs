// 给旧页面回归注入真实暂停能力，保留各测试原有的可控时钟。
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.TYPESCRIPT_PATH||'/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const root=path.resolve(__dirname,'..');
const code=['game-scoring','spot-change','training-clock','training-session','training-tween'].map(name=>fs.readFileSync(path.join(root,'utils',name+'.uts'),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
exports.install=ctx=>{
 // Game logic tests record semantic events; dedicated feedback tests exercise real audio lifecycle.
 ctx.feedbackEvents=[];
 ctx.createTrainingFeedback=()=>({play:kind=>ctx.feedbackEvents.push(kind),stop(){}});
 for(const name of ['onHide','onUnload','onBackPress']){
  const register=ctx[name]||(()=>{}),callbacks=[];
  ctx[name]=f=>{callbacks.push(f);register((...args)=>{let result;for(const callback of callbacks)result=callback(...args);return result})};
 }
 if(!ctx.getCurrentPages)ctx.getCurrentPages=()=>[{route:'pages/game/bird-cloud',options:{}}];
 if(!ctx.setTimeout){ctx.setTimeout=(f,ms)=>{const id=ctx.setInterval(()=>{ctx.clearInterval(id);f()},ms);return id};ctx.clearTimeout=ctx.clearInterval;}
 vm.runInContext(ts.transpile(code,{target:ts.ScriptTarget.ES2020}),ctx);
};

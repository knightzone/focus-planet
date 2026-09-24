const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const ts=require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js')
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8')
const water=read('pages/game/water-sort.uvue'),red=read('pages/game/red-green.uvue'),driver=read('pages/game/little-driver.uvue')
const layout=water.slice(water.indexOf('function layoutTubes('),water.indexOf('function clearTimer('))
for(const [width,height,inset] of [[375,667,20],[390,844,47],[414,896,47],[320,667,20]]){
 const c={Math,WATER_SORT_CAPACITY:4,TUBE_WRAP_OVERHEAD:14,tubeWidth:{value:0},tubeHeight:{value:0},slotHeight:{value:0},uni:{getWindowInfo:()=>({windowWidth:width,windowHeight:height,statusBarHeight:inset})}}
 vm.createContext(c);vm.runInContext(ts.transpile(layout+';globalThis.layout=layoutTubes'),c)
 for(let count=3;count<=7;count++){
  c.layout(count)
  const columns=count<=5?count:count===6?3:4,rows=Math.ceil(count/columns)
  assert.ok(columns*(c.tubeWidth.value+14)<=width-52,'试管行宽不溢出')
  assert.ok(44+inset+330+rows*(c.tubeHeight.value+36)+20<=height,'试管及控件高度不溢出')
  assert.ok(c.slotHeight.value>=18,'液层可辨识')
 }
}
assert.ok(water.includes("width: tubeWidth + 'px'"),'瓶托不额外撑宽')
assert.ok(red.includes('.rg-intro { position: relative;'),'准备卡位于背景之上')
assert.ok(driver.includes("state.value = 'ready'"),'准备状态不自动开始')
assert.ok(driver.includes('const targetLane = ref(0)'),'按钮选中态响应式')
for(const page of [water,red,driver]){
 assert.ok(!/<button[^>]*>\s*<(view|text|image)/.test(page),'原生button无子元素')
 const css=page.match(/<style>([\s\S]*?)<\/style>/)[1]
 assert.ok(!/\.[\w-]+\s+\.[\w-]+\s*\{/.test(css),'Android不使用后代选择器')
}
for(const file of ['backgrounds/red-green-park-v1.webp','backgrounds/water-sort-lab-v1.webp','level-thumbnails/puzzle.webp']) assert.ok(fs.statSync(path.join(root,'static/images/runtime',file)).size<60000)
console.log('PASS: 四种屏幕瓶子行列预算、背景层级、响应式换道、原生样式限制及图片大小')

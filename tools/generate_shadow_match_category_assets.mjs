import fs from 'node:fs'
import path from 'node:path'

const out = path.resolve('static/images/runtime/shadow-match')
fs.mkdirSync(out, { recursive: true })
const colors = ['#59bfe5','#ff7d83','#ffd05b','#70c993','#9b82ea','#f19b55','#5f9ee8','#ec78b1']
const dark = '#3f4a64'
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`
const shadow = body => body.replace(/#[0-9a-fA-F]{3,6}/g, '#aeb5c2')
let count = 0
function write(id, body) {
  fs.writeFileSync(path.join(out, id + '.svg'), wrap(body))
  fs.writeFileSync(path.join(out, id + '-shadow.svg'), wrap(shadow(body)))
  count += 2
}
function eyes(x1=61,x2=99,y=77){return `<circle cx="${x1}" cy="${y}" r="5" fill="#ffffff"/><circle cx="${x1}" cy="${y}" r="2.5" fill="${dark}"/><circle cx="${x2}" cy="${y}" r="5" fill="#ffffff"/><circle cx="${x2}" cy="${y}" r="2.5" fill="${dark}"/>`}

function fish(i, similarity=1) {
  const c=colors[i%colors.length], accent=colors[(i+2)%colors.length]
  const rx=similarity===1?[43,31,50,36,27][i%5]:similarity===2?38+(i%3)*4:42+(i%2)*3
  const ry=similarity===1?[24,31,18,26,35][i%5]:similarity===2?23+(i%2)*4:24+(i%2)*2
  const cx=78,cy=83,tail=similarity===3?28+(i%3)*4:24+(i%4)*6
  let extra=''
  if(i%4===0)extra=`<path fill="${accent}" d="M70 60 82 ${35-i%3*5} 95 63Z"/>`
  if(i%4===1)extra=`<path fill="${accent}" d="M74 106 88 ${133+i%2*7} 99 103Z"/>`
  if(i%4===2)extra=`<path fill="${accent}" d="M98 64 119 ${47-i%2*6} 112 74Z"/>`
  if(i%4===3)extra=`<path fill="${accent}" d="M48 69 31 ${55-i%2*7} 39 81Z"/>`
  const nose=i%5===4?`<path fill="${c}" d="M119 76 151 84 119 91Z"/>`:''
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c}"/><path fill="${accent}" d="M${cx-rx+5} ${cy} 8 ${cy-tail} 13 ${cy} 8 ${cy+tail}Z"/>${extra}${nose}<circle cx="${cx+rx-15}" cy="${cy-6}" r="5" fill="#ffffff"/><circle cx="${cx+rx-14}" cy="${cy-6}" r="2.5" fill="${dark}"/><path d="M${cx+rx-8} ${cy+8}c-7 5-13 5-18 0" fill="none" stroke="#ffffff" stroke-width="4"/>`
}

const toys = [
  () => `<circle cx="80" cy="82" r="55" fill="#5fb5e8"/><path d="M38 63c25 13 59 13 84 0M45 111c20-14 50-14 70 0M80 28v108" fill="none" stroke="#ffd05b" stroke-width="8"/>`,
  () => `<circle cx="45" cy="48" r="22" fill="#b77d58"/><circle cx="115" cy="48" r="22" fill="#b77d58"/><circle cx="80" cy="79" r="49" fill="#c99062"/><ellipse cx="80" cy="99" rx="25" ry="21" fill="#f1c18d"/>${eyes(59,101,77)}<ellipse cx="80" cy="94" rx="8" ry="6" fill="${dark}"/>`,
  () => `<path fill="#ff7d83" d="M80 15 140 78 80 141 20 78Z"/><path d="M80 141c-24 6 22 13-2 20" fill="none" stroke="#9b82ea" stroke-width="6"/><path d="M40 58h80M52 102h56" stroke="#ffd05b" stroke-width="6"/>`,
  () => `<ellipse cx="80" cy="47" rx="46" ry="17" fill="#ffd05b"/><path fill="#ef6f7b" d="M34 47h92v65H34Z"/><ellipse cx="80" cy="112" rx="46" ry="17" fill="#b75c72"/><path d="m37 25 37 40M123 25 86 65" stroke="#5b6884" stroke-width="7"/>`,
  () => `<rect x="22" y="79" width="49" height="49" rx="8" fill="#59bfe5"/><rect x="89" y="72" width="49" height="56" rx="8" fill="#ff7d83"/><rect x="55" y="27" width="51" height="51" rx="8" fill="#ffd05b"/><circle cx="47" cy="103" r="8" fill="#ffffff"/><path fill="#ffffff" d="m114 87 8 17h-16Z"/><rect x="73" y="43" width="15" height="15" fill="#ffffff"/>`
]

const vehicles = [
  () => `<path fill="#ff7d83" d="M18 91 31 59h76l27 32 9 7v25H17Z"/><circle cx="48" cy="122" r="17" fill="${dark}"/><circle cx="117" cy="122" r="17" fill="${dark}"/><path fill="#bde9ff" d="M43 65h57l18 24H34Z"/>`,
  () => `<path fill="#5fb5e8" d="M21 91h118l-15 36H38Z"/><path fill="#ffd05b" d="M76 18v68H38Z"/><path d="M80 17v78" stroke="${dark}" stroke-width="7"/>`,
  () => `<path fill="#70c993" d="M20 91h120v34H20Z"/><rect x="35" y="43" width="88" height="55" rx="12" fill="#ffd05b"/><rect x="47" y="54" width="23" height="25" fill="#d9f3ff"/><rect x="87" y="54" width="23" height="25" fill="#d9f3ff"/><circle cx="48" cy="126" r="14" fill="${dark}"/><circle cx="112" cy="126" r="14" fill="${dark}"/>`,
  () => `<path fill="#9b82ea" d="m14 89 52-18 24-53 15 4-8 49 48 18-3 12-49-3-11 42-13-2-3-40-49 3Z"/>`,
  () => `<path fill="#ef6f7b" d="M80 11c26 22 35 49 28 78l-28 27-28-27c-7-29 2-56 28-78Z"/><circle cx="80" cy="58" r="15" fill="#bde9ff" stroke="#ffffff" stroke-width="5"/><path fill="#ffd05b" d="m54 84-25 17 6-33 18-13M106 84l25 17-6-33-18-13M65 108l15 42 15-42Z"/>`
]

const fruits = [
  () => `<path fill="#ef5f6c" d="M80 46c31-24 59-1 56 36-3 38-31 65-56 52-25 13-53-14-56-52-3-37 25-60 56-36Z"/><path d="M80 45c0-15 5-25 16-33" stroke="#66503e" stroke-width="7"/><path fill="#70c993" d="M87 30c14-16 29-10 37 1-13 8-25 8-37-1Z"/>`,
  () => `<path fill="#ffd05b" d="M28 43c13 55 43 85 103 72-30 35-93 37-116-18-9-23-3-43 13-54Z"/><path d="M30 43c8 3 12 7 14 14" stroke="#7c6345" stroke-width="7"/>`,
  () => `<path fill="#f3c74f" d="M37 67c0-28 18-44 43-44s43 16 43 44v48c0 27-19 39-43 39s-43-12-43-39Z"/><path fill="#70c993" d="m80 39-8-34 19 29 11-28 1 35 25-20-15 37H47L32 21l25 20 1-35 11 28 11-29Z"/>`,
  () => `<path fill="#ef6073" d="M25 54c18-25 92-25 110 0-6 47-27 79-55 96-28-17-49-49-55-96Z"/><path fill="#70c993" d="m80 55-17-29 1 29-32-17 22 28 26-11 26 11 22-28-32 17 1-29Z"/>`,
  () => `<circle cx="62" cy="55" r="23" fill="#9b82ea"/><circle cx="98" cy="55" r="23" fill="#8a6ad9"/><circle cx="45" cy="88" r="23" fill="#9b82ea"/><circle cx="80" cy="88" r="23" fill="#8a6ad9"/><circle cx="115" cy="88" r="23" fill="#9b82ea"/><circle cx="62" cy="120" r="23" fill="#8a6ad9"/><circle cx="98" cy="120" r="23" fill="#9b82ea"/><path fill="#70c993" d="M80 33c6-22 24-28 42-17-9 17-23 23-42 17Z"/>`
]

const garden = [
  () => `<path fill="#ff7d83" d="M21 76c4-37 29-57 59-57s55 20 59 57Z"/><path fill="#ffd9a5" d="M59 76h42l11 61c-18 10-46 10-64 0Z"/>`,
  () => `<circle cx="80" cy="72" r="21" fill="#ffd05b"/><g fill="#ec78b1"><ellipse cx="80" cy="29" rx="17" ry="27"/><ellipse cx="80" cy="115" rx="17" ry="27"/><ellipse cx="37" cy="72" rx="27" ry="17"/><ellipse cx="123" cy="72" rx="27" ry="17"/></g><path d="M80 124v31" stroke="#70c993" stroke-width="9"/>`,
  () => `<path d="M80 71v78" stroke="#8a5c45" stroke-width="18"/><circle cx="80" cy="56" r="43" fill="#70c993"/><circle cx="48" cy="73" r="31" fill="#63bd7f"/><circle cx="112" cy="73" r="31" fill="#63bd7f"/>`,
  () => `<path fill="#70c993" d="M63 18h34v127H63Z"/><path fill="#70c993" d="M61 70c-27 2-36-14-34-39h22c-1 13 2 21 14 21ZM99 93c27 2 36-14 34-39h-22c1 13-2 21-14 21Z"/><path d="M72 39v78M88 29v95" stroke="#4fa86d" stroke-width="4"/>`,
  () => `<path fill="#ffd05b" d="M47 107c5-33 28-49 57-42 26 6 35 30 28 54H47Z"/><circle cx="72" cy="85" r="35" fill="#f19b55"/><circle cx="72" cy="85" r="19" fill="#ffd05b"/><path fill="#70c993" d="M28 104c18-14 39-11 51 14-17 25-51 29-66 6Z"/><circle cx="28" cy="116" r="4" fill="${dark}"/>`
]

function wheeledToy(i){
  const c=colors[i], roof=35+i*3, length=88+(i%3)*10, x=(160-length)/2
  const trailer=i===4?`<rect x="112" y="79" width="37" height="32" rx="5" fill="${colors[6]}"/>`:''
  return `<path fill="${c}" d="M${x} 83h${length}v35H${x}Z"/><path fill="${colors[(i+2)%8]}" d="M${x+18} 83  ${x+34} ${roof} ${x+67} ${roof} ${x+83} 83Z"/>${trailer}<circle cx="${x+28}" cy="119" r="${12+i%2*3}" fill="${dark}"/><circle cx="${x+length-25}" cy="119" r="${12+(i+1)%2*3}" fill="${dark}"/><rect x="${x+41}" y="${roof+10}" width="19" height="22" fill="#d8f2ff"/>`
}
function flower(i){
  const petals=5+i, radius=30+(i%2)*7, c=colors[(i+1)%8];let p=''
  for(let n=0;n<petals;n++){const a=Math.PI*2*n/petals,x=80+Math.cos(a)*radius,y=72+Math.sin(a)*radius;p+=`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${12+i%3*2}" ry="${23-i%2*3}" fill="${c}" transform="rotate(${(a*180/Math.PI+90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`}
  return `${p}<circle cx="80" cy="72" r="${18+i%3}" fill="#ffd05b"/><path d="M80 92v62" stroke="#70c993" stroke-width="9"/><path fill="#70c993" d="M79 126c-20-20-36-8-39 7 15 6 28 3 39-7ZM81 139c18-18 34-7 37 6-14 6-26 3-37-6Z"/>`
}
function bird(i){
  const c=colors[i], tail=20+i%3*7, crest=i%2===0?`<path fill="${colors[(i+2)%8]}" d="M72 43 80 ${13-i%3*3} 89 44Z"/>`:''
  return `${crest}<ellipse cx="78" cy="86" rx="${38+i%2*3}" ry="${43-i%3*3}" fill="${c}"/><path fill="${colors[(i+3)%8]}" d="M48 85c18-20 38-10 43 14-20 15-36 10-43-14Z"/><path fill="#ffd05b" d="M114 76 151 ${86+i%2*7} 113 95Z"/><path fill="${colors[(i+1)%8]}" d="M45 101 9 ${101-tail} 25 111 9 ${101+tail}Z"/><circle cx="95" cy="69" r="6" fill="#ffffff"/><circle cx="96" cy="69" r="3" fill="${dark}"/><path d="M65 125v22M91 125v22" stroke="#e79b47" stroke-width="5"/>`
}

const desserts = [
  `<path fill="#f19b55" d="M35 74h90l-11 70H46Z"/><path fill="#ec78b1" d="M31 74c2-35 25-52 49-52s47 17 49 52c-15 15-29 2-49 2s-34 13-49-2Z"/>`,
  `<path fill="#f2be65" d="M54 72h52l-13 80H67Z"/><circle cx="80" cy="53" r="31" fill="#ec78b1"/><circle cx="65" cy="42" r="5" fill="#ffffff"/>`,
  `<circle cx="80" cy="84" r="56" fill="#f19b55"/><circle cx="80" cy="84" r="25" fill="#f7f8fc"/><path d="M42 58c21-22 55-23 77-3" stroke="#ec78b1" stroke-width="12"/>`,
  `<path fill="#ffd05b" d="M30 61h100v73H30Z"/><path fill="#ec78b1" d="M24 61c8-25 22-27 36-8 13-28 29-28 42 0 15-20 28-17 34 8Z"/><circle cx="80" cy="31" r="14" fill="#ef5f6c"/>`,
  `<path fill="#f4c66b" d="m20 44 126 24-105 76Z"/><circle cx="76" cy="75" r="13" fill="#ef5f6c"/><circle cx="49" cy="99" r="12" fill="#70c993"/><circle cx="105" cy="70" r="10" fill="#9b82ea"/>`,
  `<path fill="#ec78b1" d="M21 76c8-23 27-30 44-17 8-31 45-31 55 0 19-9 34 4 38 24-9 34-128 34-137-7Z"/><rect x="27" y="94" width="106" height="35" rx="16" fill="#f2be65"/>`
]

function cat(i){
  const c=colors[(i+1)%8], ear=18+i%4*4, spread=23+i%3*4
  const tuft=i%2===0?`<path fill="${c}" d="M68 39 79 14 87 40Z"/>`:''
  const side=i%3===0?`<path fill="${c}" d="M32 82 11 67 24 97ZM128 82l21-15-13 30Z"/>`:''
  return `${side}<path fill="${c}" d="M32 58 38 ${12+ear} 66 43c9-3 19-3 28 0l28-${31-ear} 6 46c16 31 3 74-48 81-51-7-64-50-48-81Z"/>${tuft}<path fill="#ffd6a5" d="M43 51 44 34 59 47M117 51l-1-17-15 13"/>${eyes(58,102,78)}<path fill="#ef7d91" d="m80 94-9 7h18Z"/><path d="M80 101v8M80 109c-8 7-15 7-22 0M80 109c8 7 15 7 22 0" fill="none" stroke="${dark}" stroke-width="4"/><path d="M42 96 15 90M42 105l-28 7M118 96l27-6M118 105l28 7" stroke="${dark}" stroke-width="3"/>`
}
function car(i){
  const c=colors[i], x=15+i%2*3, roofY=43+i%4*5, spoiler=i%3===0?`<path fill="${c}" d="M122 72h28v9h-25Z"/>`:''
  return `${spoiler}<path fill="${c}" d="M${x} 87 31 68h17l17-${68-roofY}h42l25 ${68-roofY} 15 8v43H${x}Z"/><path fill="#d8f2ff" d="M68 ${roofY+8}h34l18 27H55Z"/><circle cx="48" cy="120" r="${14+i%2*2}" fill="${dark}"/><circle cx="119" cy="120" r="${14+(i+1)%2*2}" fill="${dark}"/><rect x="${26+i*3}" y="${82-i%2*5}" width="${18+i%3*4}" height="9" rx="4" fill="#ffd05b"/>`
}
function dino(i){
  const c=colors[(i+2)%8], horn=i%3===0?`<path fill="#ffd05b" d="M107 42 132 22 124 51Z"/>`:'', plates=i%2===0?`<path fill="${colors[(i+4)%8]}" d="M42 79 28 57 53 64 48 39 70 57 79 31 91 58Z"/>`:''
  return `${plates}<ellipse cx="77" cy="94" rx="${45+i%3*3}" ry="${32+i%2*4}" fill="${c}"/><path fill="${c}" d="M103 90c-1-35 8-57 28-61 23 17 18 45-7 52l-4 39Z"/><path fill="${c}" d="M39 97 7 ${76-i%3*7} 28 113Z"/>${horn}<path fill="${c}" d="M54 116 45 151h21l7-30M100 116l7 35h21l-15-40Z"/><circle cx="132" cy="50" r="5" fill="#ffffff"/><circle cx="133" cy="50" r="2.5" fill="${dark}"/>`
}
function plane(i){
  const c=colors[i], wing=31+i%4*6, tail=15+i%3*4
  return `<path fill="${c}" d="M73 14h14l8 54 48 ${75-i%2*6} 5 13-51 13-10 50H73l-8-50-51-13 5-13 48-7Z"/><path fill="${colors[(i+2)%8]}" d="m42 78 ${42-wing} 102 71 91ZM118 78 ${118+wing} 102 89 91Z"/><path fill="${colors[(i+3)%8]}" d="m67 126-${tail} 22 20-8 21 8-${15+i%2*4}-23Z"/><circle cx="80" cy="43" r="6" fill="#d8f2ff"/>`
}

const groups = [
  {id:'low-fish',labels:['燕鱼','河豚','旗鱼','鲨鱼','海马'],make:i=>fish(i,1)},
  {id:'low-toys',labels:['皮球','小熊','风筝','小鼓','积木'],make:i=>toys[i]()},
  {id:'low-vehicles',labels:['汽车','帆船','火车','飞机','火箭'],make:i=>vehicles[i]()},
  {id:'low-fruits',labels:['苹果','香蕉','菠萝','草莓','葡萄'],make:i=>fruits[i]()},
  {id:'low-garden',labels:['蘑菇','花朵','大树','仙人掌','蜗牛'],make:i=>garden[i]()},
  {id:'mid-fish',labels:['蓝尾鱼','圆尾鱼','长鳍鱼','短鳍鱼','尖嘴鱼','扇尾鱼'],make:i=>fish(i,2)},
  {id:'mid-toy-cars',labels:['赛车','巴士','卡车','吉普','拖车','小轿车'],make:i=>wheeledToy(i)},
  {id:'mid-flowers',labels:['五瓣花','六瓣花','七瓣花','八瓣花','九瓣花','十瓣花'],make:i=>flower(i)},
  {id:'mid-birds',labels:['红鸟','蓝鸟','黄鸟','绿鸟','紫鸟','粉鸟'],make:i=>bird(i)},
  {id:'mid-desserts',labels:['纸杯蛋糕','冰淇淋','甜甜圈','生日蛋糕','披萨','马卡龙'],make:i=>desserts[i]},
  {id:'high-fish',labels:['珊瑚鱼1','珊瑚鱼2','珊瑚鱼3','珊瑚鱼4','珊瑚鱼5','珊瑚鱼6','珊瑚鱼7','珊瑚鱼8'],make:i=>fish(i,3)},
  {id:'high-cats',labels:['猫咪1','猫咪2','猫咪3','猫咪4','猫咪5','猫咪6','猫咪7','猫咪8'],make:i=>cat(i)},
  {id:'high-cars',labels:['汽车1','汽车2','汽车3','汽车4','汽车5','汽车6','汽车7','汽车8'],make:i=>car(i)},
  {id:'high-dinos',labels:['恐龙1','恐龙2','恐龙3','恐龙4','恐龙5','恐龙6','恐龙7','恐龙8'],make:i=>dino(i)},
  {id:'high-planes',labels:['飞机1','飞机2','飞机3','飞机4','飞机5','飞机6','飞机7','飞机8'],make:i=>plane(i)}
]

for (const group of groups) {
  for (let i=0;i<group.labels.length;i++) write(group.id+'-'+(i+1),group.make(i))
}
fs.writeFileSync(path.join(out,'groups.json'),JSON.stringify(groups.map(g=>({id:g.id,labels:g.labels})),null,2)+'\n')
console.log(`Generated ${groups.length} category groups, ${count/2} unique objects and ${count} SVG assets`)

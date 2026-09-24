// 听声捉图形：生成 3 形状 × 4 颜色 = 12 个图形素材（纯 SVG，确定性生成，不用图像模型）。
//
// 形状：circle / square / triangle；颜色：red / yellow / green / blue。
// 平涂无描边、柔和粉彩；固定 viewBox 100×100，运行时按方形缩放。
//
// 用法：node tools/generate-listen-find-shapes.cjs

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'static/images/runtime/listen-find-shapes')

const SHAPES = ['circle', 'square', 'triangle']
// 色系对齐「魔法规则」那套柔和粉彩（蓝 #5b8def、黄 #ffc857 出自魔法规则，红/绿取仓库其它柔和色），
// 并且**不描边**：图形是平涂色块，看起来更柔和、也没有「外边框」。
const COLORS = [
  { id: 'red', fill: '#ef7b8a' },
  { id: 'yellow', fill: '#ffc857' },
  { id: 'green', fill: '#5ec9a5' },
  { id: 'blue', fill: '#5b8def' }
]

function body(shape, fill) {
  const common = `fill="${fill}"`
  if (shape == 'circle') return `  <circle cx="50" cy="50" r="43" ${common} />`
  if (shape == 'square') return `  <rect x="9" y="9" width="82" height="82" rx="16" ${common} />`
  return `  <polygon points="50,11 91,86 9,86" ${common} />`
}

fs.mkdirSync(output, { recursive: true })
const written = []
for (const shape of SHAPES) {
  for (const color of COLORS) {
    const file = path.join(output, `${shape}-${color.id}.svg`)
    fs.writeFileSync(
      file,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">\n${body(shape, color.fill)}\n</svg>\n`
    )
    written.push(path.basename(file))
  }
}
console.log(JSON.stringify({ files: written.length, directory: 'static/images/runtime/listen-find-shapes', names: written }))

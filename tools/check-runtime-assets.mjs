import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoots = ['pages', 'components', 'utils']
const sourceFiles = [path.join(projectDir, 'App.uvue'), path.join(projectDir, 'pages.json')]

function collectFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectFiles(fullPath)
    else if (/\.(uvue|uts|json)$/.test(entry.name)) sourceFiles.push(fullPath)
  }
}

for (const sourceRoot of sourceRoots) collectFiles(path.join(projectDir, sourceRoot))

const missing = []
const checked = new Set()
const dynamicAudioPaths = [
  'static/audio/cues/star.mp3',
  'static/audio/cues/moon.mp3',
  'static/audio/cues/planet.mp3',
  'static/audio/filter/star.mp3',
  'static/audio/filter/moon.mp3',
  'static/audio/filter/planet.mp3',
  'static/audio/location/left.mp3',
  'static/audio/location/center.mp3',
  'static/audio/location/right.mp3'
]

for (const relativePath of dynamicAudioPaths) {
  checked.add(relativePath)
  if (!fs.existsSync(path.join(projectDir, relativePath))) missing.push(relativePath)
}

for (const sourceFile of sourceFiles) {
  const content = fs.readFileSync(sourceFile, 'utf8')
  const staticPathPattern = /\/?static\/[A-Za-z0-9_./-]+\.(?:webp|png|jpg|jpeg|svg|wav|mp3)/g
  for (const match of content.matchAll(staticPathPattern)) {
    const relativePath = match[0].replace(/^\//, '')
    if (checked.has(relativePath)) continue
    checked.add(relativePath)
    if (!fs.existsSync(path.join(projectDir, relativePath))) missing.push(relativePath)
  }

  if (sourceFile.endsWith(path.join('pages', 'game', 'shape-match.uvue'))) {
    const illustrationPattern = /illustration\('([^']+)'\s*,\s*'([^']+)'/g
    for (const match of content.matchAll(illustrationPattern)) {
      for (const suffix of ['.webp', '-shadow.webp']) {
        const relativePath = `static/images/runtime/illustrations/shadow-match/${match[1]}/${match[2]}${suffix}`
        if (!fs.existsSync(path.join(projectDir, relativePath))) missing.push(relativePath)
      }
    }
  }
}

if (missing.length > 0) {
  console.error(`发现 ${missing.length} 个缺失运行资源：`)
  for (const relativePath of [...new Set(missing)].sort()) console.error(`- ${relativePath}`)
  process.exit(1)
}

console.log(`运行资源检查通过：${checked.size} 个静态引用，影子配对动态素材完整。`)

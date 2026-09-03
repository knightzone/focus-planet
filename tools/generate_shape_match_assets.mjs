import fs from 'node:fs'
import path from 'node:path'

const outputDir = path.resolve('static/images/runtime/shape-match')
fs.mkdirSync(outputDir, { recursive: true })

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`

const objects = [
  ['rocket', `<path fill="#ff6f7d" d="M80 12c22 18 33 43 29 70L80 111 51 82c-4-27 7-52 29-70Z"/><circle cx="80" cy="56" r="15" fill="#8dd9ff" stroke="#fff" stroke-width="6"/><path fill="#ffcc57" d="m54 77-23 13 4-29 17-10M106 77l23 13-4-29-17-10M65 105l15 42 15-42Z"/><path fill="#ff8f43" d="m72 108 8 25 8-25Z"/>`],
  ['fish', `<path fill="#58c7de" d="M25 80c22-32 61-42 91-16l24-21-4 37 4 37-24-21C86 122 47 112 25 80Z"/><path fill="#86dfc7" d="M67 56 82 31l17 29M67 104l15 25 17-29"/><circle cx="54" cy="72" r="6" fill="#fff"/><circle cx="55" cy="72" r="3" fill="#263756"/><path d="M36 88c7 5 14 5 21 0" fill="none" stroke="#277b9a" stroke-width="5"/>`],
  ['mushroom', `<path fill="#ff7c89" d="M22 75c3-35 27-56 58-56s55 21 58 56c-17 7-99 7-116 0Z"/><circle cx="54" cy="49" r="10" fill="#fff2cb"/><circle cx="103" cy="43" r="8" fill="#fff2cb"/><path fill="#ffe0ad" d="M58 76h44l10 60c-18 10-46 10-64 0Z"/><circle cx="70" cy="104" r="4" fill="#594760"/><circle cx="91" cy="104" r="4" fill="#594760"/><path d="M72 118c6 5 12 5 18 0" fill="none" stroke="#d98972" stroke-width="4"/>`],
  ['sailboat', `<path fill="#66b8f0" d="M21 105h119l-15 31H39Z"/><path fill="#ffcd55" d="M75 18v83H35Z"/><path fill="#ff7a71" d="M84 31v70h39Z"/><path d="M80 17v91" stroke="#455476" stroke-width="7"/><circle cx="50" cy="121" r="5" fill="#fff"/><circle cx="80" cy="121" r="5" fill="#fff"/>`],
  ['butterfly', `<ellipse cx="49" cy="61" rx="31" ry="38" fill="#ba86f3" transform="rotate(-24 49 61)"/><ellipse cx="111" cy="61" rx="31" ry="38" fill="#ff87b3" transform="rotate(24 111 61)"/><ellipse cx="52" cy="111" rx="25" ry="30" fill="#7fd7ef" transform="rotate(20 52 111)"/><ellipse cx="108" cy="111" rx="25" ry="30" fill="#ffd064" transform="rotate(-20 108 111)"/><ellipse cx="80" cy="84" rx="12" ry="48" fill="#655177"/><path d="M75 40C65 23 56 20 49 18M85 40c10-17 19-20 26-22" fill="none" stroke="#655177" stroke-width="5"/>`],

  ['apple', `<path fill="#ef5d62" d="M80 48c29-24 61-5 59 35-2 38-31 66-59 53-28 13-57-15-59-53-2-40 30-59 59-35Z"/><path d="M80 48c-2-15 2-25 12-35" fill="none" stroke="#664b3c" stroke-width="8"/><path fill="#63b969" d="M86 30c15-18 32-12 40 0-14 9-27 10-40 0Z"/>`],
  ['pear', `<path fill="#b9d95b" d="M80 25c17 0 24 19 22 35 28 15 39 50 22 72-18 22-70 22-88 0-17-22-6-57 22-72-2-16 5-35 22-35Z"/><path d="M82 29c0-10 5-17 13-22" fill="none" stroke="#6b5138" stroke-width="7"/><path fill="#68b968" d="M89 23c12-14 26-9 32 1-11 7-22 7-32-1Z"/>`],
  ['orange', `<circle cx="80" cy="86" r="57" fill="#ff9f43"/><path d="M79 32c-1-12 3-20 12-26" fill="none" stroke="#72513a" stroke-width="7"/><path fill="#65bb67" d="M84 27c14-17 31-11 39 1-14 9-27 9-39-1Z"/><circle cx="55" cy="73" r="3" fill="#e87f2f"/><circle cx="105" cy="91" r="3" fill="#e87f2f"/>`],
  ['strawberry', `<path fill="#f15f71" d="M25 55c13-26 97-26 110 0-4 49-26 80-55 96-29-16-51-47-55-96Z"/><path fill="#60b968" d="M80 55 60 31l2 25-33-18 21 29 30-12 30 12 21-29-33 18 2-25Z"/><g fill="#ffe08a"><ellipse cx="55" cy="84" rx="4" ry="7"/><ellipse cx="86" cy="76" rx="4" ry="7"/><ellipse cx="108" cy="96" rx="4" ry="7"/><ellipse cx="72" cy="116" rx="4" ry="7"/></g>`],
  ['cherry', `<path d="M51 70c1-28 16-47 43-58M109 70c-1-28-10-45-15-58" fill="none" stroke="#5aa45d" stroke-width="8"/><path fill="#69bd69" d="M91 19c15-18 34-13 42 2-15 10-29 10-42-2Z"/><circle cx="49" cy="103" r="31" fill="#e94e62"/><circle cx="111" cy="103" r="31" fill="#d83f58"/><circle cx="40" cy="92" r="7" fill="#ff8290"/>`],
  ['pineapple', `<path fill="#f4c64e" d="M35 72c0-27 20-43 45-43s45 16 45 43v42c0 27-20 40-45 40s-45-13-45-40Z"/><path fill="#55b76a" d="m80 38-7-32 18 28 10-27 2 34 24-19-14 34H48L34 22l24 19 2-34 10 27 10-28Z"/><g stroke="#d79b35" stroke-width="5"><path d="m46 77 68 55M46 105l53 43M114 77l-68 55M114 105l-53 43"/></g>`],

  ['cat', `<path fill="#f2a85c" d="m31 58 7-42 29 25c9-3 17-3 26 0l29-25 7 42c15 30 4 76-49 80-53-4-64-50-49-80Z"/><path fill="#ffd5a0" d="m41 48 2-19 15 15M119 48l-2-19-15 15"/><circle cx="58" cy="76" r="6" fill="#3e4358"/><circle cx="102" cy="76" r="6" fill="#3e4358"/><path fill="#ef7790" d="m80 88-8 7h16Z"/><path d="M80 95v8M80 103c-7 7-14 7-20 1M80 103c7 7 14 7 20 1" fill="none" stroke="#6e5260" stroke-width="4"/>`],
  ['bunny', `<path fill="#90c7ee" d="M54 53C27 19 41 2 54 10c13 8 17 27 18 40 5-1 11-1 16 0 1-13 5-32 18-40 13-8 27 9 0 43 22 11 30 31 25 52-7 29-35 39-51 39s-44-10-51-39c-5-21 3-41 25-52Z"/><path d="M52 19c7 9 10 19 11 29M108 19c-7 9-10 19-11 29" fill="none" stroke="#f6a9bd" stroke-width="7"/><circle cx="58" cy="85" r="5" fill="#3f4e69"/><circle cx="102" cy="85" r="5" fill="#3f4e69"/><ellipse cx="80" cy="99" rx="8" ry="6" fill="#f28da4"/>`],
  ['bear', `<circle cx="42" cy="45" r="23" fill="#ae774f"/><circle cx="118" cy="45" r="23" fill="#ae774f"/><circle cx="80" cy="88" r="57" fill="#bd8459"/><circle cx="80" cy="101" r="28" fill="#e7bd8d"/><circle cx="58" cy="79" r="6" fill="#3d3d4f"/><circle cx="102" cy="79" r="6" fill="#3d3d4f"/><ellipse cx="80" cy="94" rx="9" ry="7" fill="#4c3d40"/><path d="M80 101c-6 9-13 11-20 7M80 101c6 9 13 11 20 7" fill="none" stroke="#765147" stroke-width="4"/>`],
  ['fox', `<path fill="#f28a45" d="m21 27 45 20c9-3 19-3 28 0l45-20-12 55c4 34-17 61-47 61S29 116 33 82Z"/><path fill="#ffd6a5" d="m33 43 27 13-22 18M127 43l-27 13 22 18M80 137c-24-4-34-21-38-42 18 7 29 3 38-10 9 13 20 17 38 10-4 21-14 38-38 42Z"/><circle cx="58" cy="78" r="6" fill="#3c4353"/><circle cx="102" cy="78" r="6" fill="#3c4353"/><path fill="#4f4145" d="m80 98-9 7h18Z"/>`],
  ['panda', `<circle cx="43" cy="43" r="25" fill="#454657"/><circle cx="117" cy="43" r="25" fill="#454657"/><circle cx="80" cy="88" r="57" fill="#f4f2e9"/><ellipse cx="57" cy="78" rx="16" ry="21" fill="#454657" transform="rotate(25 57 78)"/><ellipse cx="103" cy="78" rx="16" ry="21" fill="#454657" transform="rotate(-25 103 78)"/><circle cx="58" cy="77" r="5" fill="#fff"/><circle cx="102" cy="77" r="5" fill="#fff"/><ellipse cx="80" cy="103" rx="10" ry="8" fill="#454657"/>`],
  ['dog', `<path fill="#d49a63" d="M43 48c22-19 52-19 74 0 20 18 22 61 4 81-18 19-64 19-82 0-18-20-16-63 4-81Z"/><path fill="#9a684c" d="M47 48C34 20 8 25 15 63c4 23 19 32 31 20M113 48c13-28 39-23 32 15-4 23-19 32-31 20"/><circle cx="59" cy="78" r="6" fill="#3e3c4c"/><circle cx="101" cy="78" r="6" fill="#3e3c4c"/><ellipse cx="80" cy="98" rx="10" ry="8" fill="#4c4142"/><path d="M80 105c0 15-18 19-23 5M80 105c0 15 18 19 23 5" fill="none" stroke="#76504a" stroke-width="5"/>`],
  ['koala', `<circle cx="38" cy="55" r="31" fill="#9aa9b5"/><circle cx="122" cy="55" r="31" fill="#9aa9b5"/><circle cx="38" cy="55" r="18" fill="#c9d1d7"/><circle cx="122" cy="55" r="18" fill="#c9d1d7"/><circle cx="80" cy="91" r="55" fill="#aebac3"/><circle cx="59" cy="80" r="6" fill="#364052"/><circle cx="101" cy="80" r="6" fill="#364052"/><ellipse cx="80" cy="101" rx="15" ry="21" fill="#4b5261"/><path d="M80 119c-7 7-14 7-20 1M80 119c7 7 14 7 20 1" fill="none" stroke="#68717e" stroke-width="4"/>`],
  ['tiger', `<path fill="#f2a447" d="m30 55 4-39 31 25c10-3 20-3 30 0l31-25 4 39c17 30 5 77-50 84-55-7-67-54-50-84Z"/><path d="m80 40-8 25h16ZM40 52l19 14M120 52l-19 14M39 93l20-5M121 93l-20-5" fill="none" stroke="#5e4a43" stroke-width="7"/><circle cx="58" cy="78" r="6" fill="#383d4e"/><circle cx="102" cy="78" r="6" fill="#383d4e"/><path fill="#ef7f8f" d="m80 96-9 7h18Z"/><path fill="#fff1d4" d="M80 104c-8 18-27 20-38 7 10 28 66 28 76 0-11 13-30 11-38-7Z"/>`]
]

let generatedCount = 0

function writeObject(id, body) {
  const colorSvg = wrap(body)
  const shadowBody = body
    .replace(/#[0-9a-fA-F]{3,6}/g, '#aeb5c2')
    .replace(/fill="none"/g, 'fill="none"')
  fs.writeFileSync(path.join(outputDir, `${id}.svg`), colorSvg)
  fs.writeFileSync(path.join(outputDir, `${id}-shadow.svg`), wrap(shadowBody))
  generatedCount += 2
}

for (const [id, body] of objects) {
  writeObject(id, body)
}

const palettes = [
  ['#ff7d8f', '#ffd166', '#65c7d0', '#8b75df'],
  ['#63c58f', '#8dd5ff', '#ffc85a', '#f08bb4'],
  ['#8d7be8', '#ff9e57', '#73d2b0', '#ffd867'],
  ['#ef6f6c', '#5fb5e8', '#b6d957', '#f2a65a']
]
const tierSlices = [
  ['low', objects.slice(0, 5)],
  ['mid', objects.slice(5, 11)],
  ['high', objects.slice(11, 19)]
]

function recolor(body, palette, offset) {
  let colorIndex = 0
  return body.replace(/#[0-9a-fA-F]{3,6}/g, (color) => {
    const normalized = color.toLowerCase()
    if (normalized === '#fff' || normalized === '#ffffff' || normalized === '#3e4358' || normalized === '#3d3d4f' || normalized === '#383d4e' || normalized === '#263756') return color
    const next = palette[(colorIndex + offset) % palette.length]
    colorIndex += 1
    return next
  })
}

function decoration(variant, itemIndex, palette) {
  if (variant === 2) {
    const x = 42 + (itemIndex % 3) * 38
    return `<path fill="${palette[1]}" d="M${x} 21l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2Z"/>`
  }
  if (variant === 3) {
    const x = 54 + (itemIndex % 2) * 44
    return `<path fill="${palette[3]}" d="M${x} 26c-14-15-27-2-15 13 5 6 10 8 15 10 5-2 10-4 15-10 12-15-1-28-15-13Z"/>`
  }
  if (variant === 4) {
    return `<path fill="${palette[1]}" d="M57 34 65 12l15 17 15-17 8 22Z"/><circle cx="65" cy="25" r="3" fill="#ffffff"/><circle cx="80" cy="20" r="3" fill="#ffffff"/><circle cx="95" cy="25" r="3" fill="#ffffff"/>`
  }
  return `<path fill="${palette[2]}" d="M34 43c8-18 22-24 37-25l-8 30Z"/><circle cx="48" cy="29" r="6" fill="${palette[1]}"/>`
}

for (const [tier, entries] of tierSlices) {
  for (let variant = 2; variant <= 5; variant++) {
    const palette = palettes[variant - 2]
    for (let itemIndex = 0; itemIndex < entries.length; itemIndex++) {
      const [baseId, baseBody] = entries[itemIndex]
      const id = `${tier}${variant}-${baseId}`
      const body = recolor(baseBody, palette, itemIndex) + decoration(variant, itemIndex, palette)
      writeObject(id, body)
    }
  }
}

console.log(`Generated ${generatedCount} shape-match SVG assets in ${outputDir}`)

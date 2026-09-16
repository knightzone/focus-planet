const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let surfaces = 0;
const files = cp.execFileSync('rg', ['--files', 'pages', 'components', '-g', '*.uvue'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of content.matchAll(/<button\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/button>/g)) {
    const inner = match[0].slice(match[0].indexOf('>') + 1).replace(/<\/button>$/, '');
    assert(!/<[A-Za-z]/.test(inner), file + ': native button cannot have child elements');
  }
  const count = (content.match(/<ActionSurface\b/g) || []).length;
  if (count) assert(content.includes("import ActionSurface from '../../components/ActionSurface.uvue'"), file);
  surfaces += count;
}
assert(surfaces >= 14); // 小鸟、听音匹配改为纯文字原生按钮。
const component = fs.readFileSync(path.join(root, 'components/ActionSurface.uvue'), 'utf8');
const script = component.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1];
const props = { disabled: false }, events = [];
const context = { defineProps: () => props, defineEmits: () => name => events.push(name) };
vm.createContext(context); vm.runInContext(script + '\nglobalThis.click=handleClick', context);
context.click(); assert.deepEqual(events, ['click']);
props.disabled = true; context.click(); assert.equal(events.length, 1);
props.disabled = false; context.click(); assert.deepEqual(events, ['click', 'click']);
assert(component.includes('<slot>'));
console.log('PASS: ' + surfaces + ' rich controls; no nested native buttons; imports, slot, disabled and re-enabled clicks');

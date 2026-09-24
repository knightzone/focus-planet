// Browser review uses the same UTS conflict/backtracking rules as the game.
const fs = require('node:fs'), path = require('node:path');
const ts = require('/Applications/HBuilderX.app/Contents/HBuilderX/plugins/unicloud/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'utils/spot-difference-cycle.uts'), 'utf8').replace(/^import .*$/gm, '').replace(/^export /gm, '');
fs.writeFileSync(path.join(root, 'content/brand/spot-difference-story-v2/runtime-review/recipe-rules.js'), ts.transpile(code, {target: ts.ScriptTarget.ES2020}));

// Generate story spot-difference A/B source PNGs through an OpenAI-compatible images API.
// Reads prompts from content/brand/spot-difference-story-v2/chapter-XX/SD2-0NN-PROMPTS.md.
// No provider is bound by default; configure one explicitly (never hard-code keys):
//   STORY_IMAGE_BASE   API root, default https://api.openai.com/v1 (also works with OpenAI-compatible gateways)
//   STORY_IMAGE_KEY    API key, required
//   STORY_IMAGE_MODEL  default gpt-image-1; e.g. doubao-seedream-4-5-251128 on Volcengine Ark
//   STORY_IMAGE_SIZE   landscape size, default 1536x1024; saved files are center-cropped to 16:9
// B is produced by the /images/edits endpoint with A as the input image (precise-object-edit flow).
// Usage:
//   node tools/generate-story-pair.cjs --id SD2-035 --chapter 4            # A then B
//   node tools/generate-story-pair.cjs --id SD2-035 --chapter 4 --a-only   # A only
// After generation: 目检 A/B -> chapter manifest 登记 -> runtime-regions.json 标注
//   -> node tools/build-story-runtime.cjs -> 四个 test-spot-difference/test-story 测试。
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def };
const id = (opt('id', '') || '').toUpperCase();
if (!/^SD2-\d{3}$/.test(id)) throw Error('usage: node tools/generate-story-pair.cjs --id SD2-0NN --chapter N');
const chapter = String(opt('chapter', '4')).padStart(2, '0');
const base = (process.env.STORY_IMAGE_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const key = process.env.STORY_IMAGE_KEY;
if (!key) throw Error('STORY_IMAGE_KEY is not set');
const model = process.env.STORY_IMAGE_MODEL || 'gpt-image-1';
const size = process.env.STORY_IMAGE_SIZE || '1536x1024';
const dir = path.join(root, 'content/brand/spot-difference-story-v2', `chapter-${chapter}`);
const promptFile = path.join(dir, `${id}-PROMPTS.md`);
if (!fs.existsSync(promptFile)) throw Error('missing prompt file: ' + promptFile);
const md = fs.readFileSync(promptFile, 'utf8');
const section = name => {
  const m = md.match(new RegExp('## ' + name + '[\\s\\S]*?\\n([\\s\\S]*?)(?=\\n## |$)'));
  if (!m) throw Error('prompt section not found in ' + promptFile + ': ' + name);
  return m[1].replace(/```\w*/g, '').trim();
};
const promptA = section('A 完整提示词'), promptB = section('B 完整提示词');
if (!promptA || !promptB) throw Error('empty prompt section in ' + promptFile);
const stem = id.toLowerCase();
const outA = path.join(dir, `${stem}-a.png`), outB = path.join(dir, `${stem}-b.png`);
const ffmpeg = '/usr/local/bin/ffmpeg';
// Normalize any provider output to PNG and center-crop to 16:9 to match the story source spec.
const save16x9 = (buf, file) => {
  const tmp = path.join(dir, `.${stem}-${path.basename(file)}.tmp`);
  fs.writeFileSync(tmp, buf);
  try {
    cp.execFileSync(ffmpeg, ['-v', 'error', '-i', tmp, '-vf', "crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'", '-frames:v', '1', '-y', file]);
  } finally { fs.unlinkSync(tmp) }
};
async function resultBuffer(data) {
  const item = (data.data || [])[0];
  if (!item) throw Error('empty data in provider response');
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw Error('provider returned neither b64_json nor url');
}
async function post(url, body, json = true) {
  const headers = { Authorization: 'Bearer ' + key };
  if (json) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + url, { method: 'POST', headers, body });
  if (!res.ok) throw Error(url + ' -> HTTP ' + res.status + ' ' + (await res.text()).slice(0, 400));
  return res.json();
}
async function generateA() {
  console.log('A: generating with ' + model + ' ...');
  const data = await post('/images/generations', JSON.stringify({ model, prompt: promptA, size, n: 1 }));
  save16x9(await resultBuffer(data), outA);
  console.log('A: saved ' + outA);
}
async function generateB() {
  if (!fs.existsSync(outA)) throw Error('A file missing, run without --b-only first: ' + outA);
  console.log('B: editing A with ' + model + ' ...');
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', promptB);
  form.append('image', new Blob([fs.readFileSync(outA)]), path.basename(outA));
  const data = await post('/images/edits', form, false);
  save16x9(await resultBuffer(data), outB);
  console.log('B: saved ' + outB);
}
(async () => {
  const mode = args.includes('--b-only') ? 'b' : args.includes('--a-only') ? 'a' : 'ab';
  if (mode !== 'b') await generateA();
  if (mode !== 'a') await generateB();
  fs.writeFileSync(path.join(dir, `${stem}-source.json`), JSON.stringify({
    id, model, endpoint: base, size, crop: '16:9 center',
    promptFile: `${id}-PROMPTS.md`, aFile: `${stem}-a.png`, bFile: `${stem}-b.png`,
    generatedAt: new Date().toISOString()
  }, null, 2));
  console.log('done: ' + path.join(dir, `${stem}-source.json`));
})().catch(e => { console.error(e.message); process.exit(1) });

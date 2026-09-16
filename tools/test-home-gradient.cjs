const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),home=fs.readFileSync(path.join(root,'pages/index/index.uvue'),'utf8');
assert(!home.includes('<focus-gradient'));assert(!home.includes('NativeGradient'));
assert(home.includes('/static/images/runtime/brand/hero-edge-blend-v1.svg'));
const svg=fs.readFileSync(path.join(root,'static/images/runtime/brand/hero-edge-blend-v1.svg'),'utf8');
assert(svg.includes('viewBox="0 0 52 170"'));assert(svg.includes('offset=".34"'));assert(svg.includes('stop-opacity=".72"'));assert(svg.includes('stop-opacity="0"'));assert(svg.includes('#4f7fe3'));
const sync=fs.readFileSync(path.join(root,'ios/scripts/sync-resources.sh'),'utf8');assert(!sync.includes('Missing generated iOS gradient source'));
console.log('PASS: homepage gradient is a static transparent asset; native module not instantiated; original size/colors preserved; iOS no longer requires gradient source');

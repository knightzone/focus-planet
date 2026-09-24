const fs = require('fs')
const assert = require('assert/strict')
const page = fs.readFileSync('pages/companion/companion.uvue', 'utf8')
const mine = fs.readFileSync('pages/mine/mine.uvue', 'utf8')

for (const forbidden of ['<camera', 'detectFaceFrame', 'createCameraContext', 'toggleCameraAnalysis', '坐姿自检', '坐姿陪伴', 'cameraEnabled.value']) {
  assert.equal(page.includes(forbidden), false, `pomodoro page must not activate ${forbidden}`)
}
assert.ok(page.includes('开始专注') && page.includes('暂停') && page.includes('休息中'), 'focus/pause/break controls remain')
assert.ok(page.includes('cameraEnabled: false') && page.includes('postureReminderCount: 0'), 'new companion sessions have no camera or posture metrics')
assert.equal(mine.includes('稳定在屏'), false, 'personal center hides old observation summary')
console.log('PASS: 星陪伴仅保留番茄钟，不启动相机或坐姿提醒')

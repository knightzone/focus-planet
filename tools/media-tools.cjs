// 媒体工具路径统一解析，避免在脚本里写死 /usr/local/bin。
// 优先级：环境变量（FFMPEG_PATH / FFPROBE_PATH / CWEBP_PATH）→ PATH → Homebrew 前缀。
// Apple Silicon 上 Homebrew 装在 /opt/homebrew，Intel 上是 /usr/local，两者都要兜住。
const fs = require('node:fs')
const path = require('node:path')

const HOMEBREW_PREFIXES = ['/opt/homebrew/bin', '/usr/local/bin']

function resolveMediaTool(name, envVar) {
  const override = process.env[envVar]
  if (override != null && override !== '') return override
  const fromPath = (process.env.PATH || '')
    .split(path.delimiter)
    .filter(directory => directory.length > 0)
    .map(directory => path.join(directory, name))
  const candidates = fromPath.concat(HOMEBREW_PREFIXES.map(prefix => path.join(prefix, name)))
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch (_error) {
      // 继续找下一个候选路径
    }
  }
  // 都没找到时返回裸命令名，让调用方收到标准的 ENOENT，提示安装 ffmpeg/webp 或设置环境变量。
  return name
}

module.exports = {
  ffmpeg: resolveMediaTool('ffmpeg', 'FFMPEG_PATH'),
  ffprobe: resolveMediaTool('ffprobe', 'FFPROBE_PATH'),
  cwebp: resolveMediaTool('cwebp', 'CWEBP_PATH')
}

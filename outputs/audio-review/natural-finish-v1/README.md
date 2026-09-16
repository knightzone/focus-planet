# 自然结算语音试听

2026-09-13，仅试听，不替换static运行音频，无需同步Xcode。

相同文案：这一段训练完成啦。休息一下，放松小手，我们慢慢来。

- xiaoxiao.mp3：zh-CN-XiaoxiaoNeural，服务音色标签Warm。
- xiaoyi.mp3：zh-CN-XiaoyiNeural，服务音色标签Lively。

通过edge-tts 7.2.8调用在线服务生成，仅发送以上公共文案；语速-8%，自然音高，输出统一为单声道24kHz/64kbps，响度目标-21LUFS。保留raw原始输出。文件时长与格式已验证，实际自然度待用户试听确认。

可复现入口：tools/build-natural-voice-preview.cjs，EDGE_TTS_CLI可指定独立环境的CLI路径。临时环境默认/private/tmp/focus-natural-voice-env，不要求App安装任何TTS依赖。

工具参考：[edge-tts项目文档](https://github.com/rany2/edge-tts)。此方案用于音色试听；工具开源许可不等于在线声音的商用授权，正式发行应确认服务许可或使用授权的正式TTS接口。

# 晓晓结算语音（已选用）

用户确认使用晓晓后生成的四句正式开发素材。运行副本：static/audio/feedback/finish-1.mp3 至 finish-4.mp3。

音色zh-CN-XiaoxiaoNeural；语速-8%、自然音高、-21LUFS，与已选试听样音相同。文案读取utils/training-feedback.uts中的FINISH_VOICE_LINES，避免画面与语音不一致。

时长依次3.576、4.128、4.656、4.920秒；24kHz单声道64kbps MP3。raw为在线服务原始输出，previous-tingting保留旧版，均不进入static运行包。

复现：tools/build-xiaoxiao-finish.cjs --install，EDGE_TTS_CLI指定edge-tts程序位置。只发送公共结算文案，无用户资料。服务声音商用许可需在发行前另行确认。

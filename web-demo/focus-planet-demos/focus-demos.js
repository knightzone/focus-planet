(() => {
  'use strict';
  const scriptUrl = document.currentScript ? document.currentScript.src : location.href;
  const base = new URL('.', scriptUrl);
  const asset = (name) => new URL('assets/' + name, base).href;
  const games = [
    { id: 'match', name: '影子配对', category: '逻辑空间', cover: 'shape-match.webp', bg: 'shadow-match-desk-v1.webp' },
    { id: 'penalty', name: '点球小将', category: '切换兼顾', cover: 'penalty-kick.webp', bg: 'penalty-stadium-v1.webp' },
    { id: 'audio', name: '听音节奏', category: '记忆辨识', cover: 'audio-sequence.webp', bg: 'star-catcher-sky-v1.webp' }
  ];
  const fruits = [
    { id: 'apple', name: '苹果' }, { id: 'banana', name: '香蕉' }, { id: 'grapes', name: '葡萄' }
  ];
  const sounds = ['i2-p4-r0.mp3', 'i0-p0-r0.mp3', 'i4-p1-r0.mp3'];
  const lanes = ['left', 'center', 'right'];
  const laneLabels = { left: '左路', center: '中路', right: '右路' };

  class FocusPlanetDemos {
    constructor(host) {
      this.host = host;
      this.game = 'match';
      this.timer = null;
      this.keeperTimer = null;
      this.nextTimer = null;
      this.audio = null;
      this.audioToken = 0;
      this.match = { selected: '', matched: [] };
      this.penalty = { started: false, round: 0, goals: 0, saves: 0, misses: 0, keeper: 'center', keeperStep: 0, power: 0, rising: true, locked: false };
      this.audioState = { phase: 'ready', played: 0, choice: -1 };
      this.onClick = (event) => this.click(event);
      this.onDragStart = (event) => this.dragStart(event);
      this.onDragOver = (event) => this.dragOver(event);
      this.onDrop = (event) => this.drop(event);
      this.mount();
    }

    mount() {
      this.host.classList.add('fpd');
      this.host.innerHTML = `
        <header class="fpd-header"><p class="fpd-kicker">专注星伴 · 官网试玩</p><h2 class="fpd-title">和跃跃、暖暖一起玩</h2><p class="fpd-subtitle">三种小游戏，打开就能体验；不登录、不记录成绩。</p></header>
        <div class="fpd-tabs" role="tablist" aria-label="选择试玩游戏"></div>
        <main class="fpd-stage" role="tabpanel" aria-live="polite"></main>
        <p class="fpd-footer">官网试玩为固定关卡，与 App 内的课程、难度和报告互不影响。<span class="fpd-download"></span></p>`;
      this.tabs = this.host.querySelector('.fpd-tabs');
      this.stage = this.host.querySelector('.fpd-stage');
      this.tabs.innerHTML = games.map(g => `<button type="button" class="fpd-tab" role="tab" data-game="${g.id}" aria-selected="false"><img src="${asset(g.cover)}" alt=""><span>${g.name}<small>${g.category}</small></span></button>`).join('');
      const downloadUrl = this.host.getAttribute('data-download-url');
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.textContent = '了解 App';
        this.host.querySelector('.fpd-download').appendChild(a);
      }
      this.host.addEventListener('click', this.onClick);
      this.host.addEventListener('dragstart', this.onDragStart);
      this.host.addEventListener('dragover', this.onDragOver);
      this.host.addEventListener('drop', this.onDrop);
      this.select('match');
    }

    stop() {
      this.stopPenaltyTimers();
      if (this.nextTimer) clearTimeout(this.nextTimer);
      this.nextTimer = null;
      this.audioToken++;
      if (this.audio) { this.audio.pause(); this.audio.src = ''; this.audio = null; }
    }

    select(id) {
      if (!games.some(g => g.id === id)) return;
      this.stop();
      this.game = id;
      this.tabs.querySelectorAll('[data-game]').forEach(tab => {
        const active = tab.dataset.game === id;
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
      });
      const game = games.find(g => g.id === id);
      this.stage.dataset.game = id;
      this.stage.style.backgroundImage = `url("${asset(game.bg)}")`;
      if (id === 'match') this.resetMatch();
      if (id === 'penalty') this.resetPenalty();
      if (id === 'audio') this.resetAudio();
    }

    frame(label) {
      const game = games.find(g => g.id === this.game);
      return `<div class="fpd-content"><div class="fpd-meta"><span>${game.category} · ${game.name}</span><span>${label}</span></div><section class="fpd-panel">`;
    }

    resetMatch() {
      this.match = { selected: '', matched: [] };
      this.renderMatch();
    }

    renderMatch(message = '点上方彩色图片，再点下方影子；电脑也可以拖动。') {
      const done = this.match.matched.length === fruits.length;
      let html = this.frame('固定入门关 · 3 组');
      html += `<h3>${done ? '全部配对成功！' : '把图案送回影子里'}</h3><p>看轮廓，找朋友。</p>`;
      html += `<div class="fpd-match-grid" aria-label="彩色图案">${fruits.map(f => {
        const matched = this.match.matched.includes(f.id);
        return `<button type="button" class="fpd-match-card ${matched ? 'fpd-matched' : this.match.selected === f.id ? 'fpd-selected' : ''}" data-pick="${f.id}" draggable="${!matched}" ${matched ? 'disabled' : ''} aria-label="选择${f.name}"><img src="${asset(f.id + '.webp')}" alt="${f.name}"></button>`;
      }).join('')}</div>`;
      html += `<p class="fpd-section-label">影子</p><div class="fpd-match-grid" aria-label="影子位置">${['banana', 'grapes', 'apple'].map(id => {
        const matched = this.match.matched.includes(id);
        const fruit = fruits.find(f => f.id === id);
        return `<button type="button" class="fpd-match-card ${matched ? 'fpd-matched' : ''}" data-slot="${id}" ${matched ? 'disabled' : ''} aria-label="${fruit.name}的影子"><img src="${asset(id + (matched ? '' : '-shadow') + '.webp')}" alt=""></button>`;
      }).join('')}</div>`;
      html += `<p class="fpd-status" role="status">${done ? '你找到了全部 3 组！' : message}</p><div class="fpd-action-row"><button type="button" class="fpd-action alt" data-action="match-reset">再玩一次</button></div></section></div>`;
      this.stage.innerHTML = html;
    }

    matchSlot(id) {
      if (this.match.matched.includes(id)) return;
      if (!this.match.selected) return this.renderMatch('先选择一张彩色图片。');
      if (this.match.selected !== id) return this.renderMatch('还不是这个影子，再看看轮廓。');
      this.match.matched.push(id);
      this.match.selected = '';
      this.renderMatch('找对啦！继续配下一组。');
    }

    dragStart(event) {
      const button = event.target.closest('[data-pick]');
      if (this.game !== 'match' || !button || button.disabled) return;
      this.match.selected = button.dataset.pick;
      event.dataTransfer.setData('text/plain', button.dataset.pick);
      event.dataTransfer.effectAllowed = 'move';
    }
    dragOver(event) { if (this.game === 'match' && event.target.closest('[data-slot]')) event.preventDefault(); }
    drop(event) {
      if (this.game !== 'match') return;
      const slot = event.target.closest('[data-slot]');
      if (!slot) return;
      event.preventDefault();
      this.match.selected = event.dataTransfer.getData('text/plain');
      this.matchSlot(slot.dataset.slot);
    }

    resetPenalty() {
      this.penalty = { started: false, round: 0, goals: 0, saves: 0, misses: 0, keeper: 'center', keeperStep: 0, power: 0, rising: true, locked: false };
      this.renderPenalty();
    }

    renderPenalty(message = '看门将的位置，等力量进入绿色区域，再选射门方向。') {
      const p = this.penalty;
      const done = p.round >= 3;
      let html = this.frame(done ? '试玩完成' : `固定入门关 · ${Math.min(p.round + 1, 3)}/3 球`);
      html += `<h3>${done ? '射门结束！' : '点球小将'}</h3><p>${done ? `你踢进了 ${p.goals} 球。` : '方向和力量，都要看准。'}</p>`;
      html += `<div class="fpd-field"><img class="fpd-keeper" src="${asset('goalkeeper-cat-ready-v1.webp')}" alt="守门员暖暖"><img class="fpd-ball" src="${asset('football-v2.webp')}" alt="足球"></div>`;
      if (!done) {
        html += `<div class="fpd-power" aria-label="力量条"><span class="fpd-power-safe"></span><span class="fpd-power-marker" style="left:${p.power}%"></span></div><div class="fpd-lanes"><button type="button" data-lane="left" ${!p.started || p.locked ? 'disabled' : ''}>↖ 左路</button><button type="button" data-lane="center" ${!p.started || p.locked ? 'disabled' : ''}>↑ 中路</button><button type="button" data-lane="right" ${!p.started || p.locked ? 'disabled' : ''}>↗ 右路</button></div>`;
      }
      html += `<p class="fpd-status" role="status">${message}</p><div class="fpd-scoreline">进球 ${p.goals}　扑出 ${p.saves}　射偏 ${p.misses}</div>`;
      if (!p.started || done) html += `<div class="fpd-action-row"><button type="button" class="fpd-action" data-action="penalty-start">${done ? '再踢三球' : '开始射门'}</button></div>`;
      html += `</section></div>`;
      this.stage.innerHTML = html;
      this.updateKeeper();
    }

    updateKeeper() {
      const keeper = this.stage.querySelector('.fpd-keeper');
      if (keeper) keeper.style.left = { left: '24%', center: '50%', right: '76%' }[this.penalty.keeper];
    }

    startPenalty() {
      this.stop();
      this.penalty = { started: true, round: 0, goals: 0, saves: 0, misses: 0, keeper: 'center', keeperStep: 0, power: 0, rising: true, locked: false };
      this.renderPenalty();
      this.timer = setInterval(() => {
        const p = this.penalty;
        if (!p.started || p.locked) return;
        p.power += p.rising ? 2 : -2;
        if (p.power >= 100) { p.power = 100; p.rising = false; }
        if (p.power <= 0) { p.power = 0; p.rising = true; }
        const marker = this.stage.querySelector('.fpd-power-marker');
        if (marker) marker.style.left = p.power + '%';
      }, 24);
      this.keeperTimer = setInterval(() => {
        const p = this.penalty;
        if (!p.started || p.locked) return;
        p.keeperStep = (p.keeperStep + 1) % 4;
        p.keeper = ['center', 'left', 'center', 'right'][p.keeperStep];
        this.updateKeeper();
      }, 1000);
    }

    shoot(lane) {
      const p = this.penalty;
      if (!p.started || p.locked || !lanes.includes(lane)) return;
      p.locked = true;
      this.stage.querySelectorAll('[data-lane]').forEach(button => button.disabled = true);
      const goodPower = p.power >= 18 && p.power <= 82;
      const result = !goodPower ? (p.power > 82 ? '力量太大，射偏啦！' : '力量太轻，门将接住了。') : lane === p.keeper ? '门将守住了这一路！' : '漂亮，球进了！';
      if (!goodPower && p.power > 82) p.misses++;
      else if (!goodPower || lane === p.keeper) p.saves++;
      else p.goals++;
      const ball = this.stage.querySelector('.fpd-ball');
      ball.style.left = { left: '25%', center: '50%', right: '75%' }[lane];
      ball.classList.add('fpd-shot');
      if (goodPower && lane === p.keeper) this.stage.querySelector('.fpd-keeper').src = asset('goalkeeper-cat-hold-v1.webp');
      this.stage.querySelector('.fpd-status').textContent = result;
      this.stage.querySelector('.fpd-scoreline').textContent = `进球 ${p.goals}　扑出 ${p.saves}　射偏 ${p.misses}`;
      this.nextTimer = setTimeout(() => {
        p.round++;
        p.locked = false;
        p.power = 0;
        p.rising = true;
        p.keeper = 'center';
        if (p.round >= 3) { this.stopPenaltyTimers(); this.renderPenalty(`3 球完成，进球 ${p.goals} 次。`); }
        else this.renderPenalty();
      }, 1350);
    }

    stopPenaltyTimers() {
      if (this.timer) clearInterval(this.timer);
      if (this.keeperTimer) clearInterval(this.keeperTimer);
      this.timer = null;
      this.keeperTimer = null;
    }

    resetAudio() {
      this.audioState = { phase: 'ready', played: 0, choice: -1 };
      this.renderAudio();
    }

    renderAudio(message = '') {
      const state = this.audioState;
      let html = this.frame('固定体验关 · 3 选 1');
      html += `<h3>听音节奏</h3><p>先听两次目标声音，再试听选项，找到相同的声音。</p>`;
      if (state.phase === 'ready' || state.phase === 'error') {
        html += `<div class="fpd-audio-target"><span class="fpd-note" aria-hidden="true">♫</span><strong>${state.phase === 'error' ? '声音播放失败，请重试' : '准备好耳朵了吗？'}</strong></div><button type="button" class="fpd-action" data-action="audio-start">${state.phase === 'error' ? '重新开始' : '开始听目标'}</button>`;
      } else {
        html += `<div class="fpd-audio-target"><span class="fpd-note" aria-hidden="true">♫</span><strong>${state.phase === 'target' ? `目标声音 · 第 ${Math.min(state.played + 1, 2)} / 2 次` : '目标已播放完，不能再听'}</strong></div>`;
      }
      if (state.phase === 'choices' || state.phase === 'done') {
        html += `<div class="fpd-options">${sounds.map((sound, i) => `<div class="fpd-option ${state.phase === 'done' && i === 1 ? 'fpd-correct' : ''} ${state.phase === 'done' && i === state.choice && i !== 1 ? 'fpd-wrong' : ''}"><strong>声音 ${i + 1}</strong><button type="button" data-listen="${i}" ${state.phase === 'done' ? 'disabled' : ''}>♫ 试听</button><button type="button" class="fpd-pick" data-answer="${i}" ${state.phase === 'done' ? 'disabled' : ''}>选这个</button></div>`).join('')}</div>`;
      }
      if (state.phase === 'done') html += `<div class="fpd-action-row"><button type="button" class="fpd-action alt" data-action="audio-reset">再试一次</button></div>`;
      html += `<p class="fpd-status" role="status">${message || (state.phase === 'target' ? '请听完固定两次，期间不需要点击。' : state.phase === 'choices' ? '试听选项后，随时可以作答。' : '')}</p></section></div>`;
      this.stage.innerHTML = html;
    }

    playSound(file, onEnded) {
      const token = ++this.audioToken;
      if (this.audio) { this.audio.pause(); this.audio.src = ''; }
      const audio = new Audio(asset(file));
      this.audio = audio;
      audio.volume = 0.75;
      audio.onended = () => { if (token === this.audioToken && onEnded) onEnded(); };
      audio.onerror = () => { if (token === this.audioToken) { console.warn('FocusPlanet demo audio error', audio.error && audio.error.code); this.audioState.phase = 'error'; this.renderAudio(); } };
      const attempt = audio.play();
      if (attempt && attempt.catch) attempt.catch((error) => {
        console.warn('FocusPlanet demo audio play rejected', error && error.name);
        if (token === this.audioToken) { this.audioState.phase = 'error'; this.renderAudio(); }
      });
    }

    startAudio() {
      this.stop();
      this.audioState = { phase: 'target', played: 0, choice: -1 };
      this.renderAudio();
      const playTarget = () => this.playSound('i0-p0-r0.mp3', () => {
        if (this.audioState.phase !== 'target') return;
        this.audioState.played++;
        if (this.audioState.played >= 2) { this.audioState.phase = 'choices'; this.renderAudio(); }
        else { this.renderAudio(); this.nextTimer = setTimeout(playTarget, 450); }
      });
      playTarget();
    }

    answerAudio(index) {
      if (this.audioState.phase !== 'choices') return;
      this.audioToken++;
      if (this.audio) this.audio.pause();
      this.audioState.choice = index;
      this.audioState.phase = 'done';
      this.renderAudio(index === 1 ? '答对啦，听出来了！' : '这次不一样；绿色框中是目标声音。');
    }

    click(event) {
      const target = event.target.closest('button');
      if (!target || !this.host.contains(target)) return;
      if (target.dataset.game) return this.select(target.dataset.game);
      if (target.dataset.action === 'match-reset') return this.resetMatch();
      if (target.dataset.action === 'penalty-start') return this.startPenalty();
      if (target.dataset.action === 'audio-start') return this.startAudio();
      if (target.dataset.action === 'audio-reset') return this.resetAudio();
      if (this.game === 'match' && target.dataset.pick) {
        this.match.selected = target.dataset.pick;
        return this.renderMatch('已经选好图案，现在点它的影子。');
      }
      if (this.game === 'match' && target.dataset.slot) return this.matchSlot(target.dataset.slot);
      if (this.game === 'penalty' && target.dataset.lane) return this.shoot(target.dataset.lane);
      if (this.game === 'audio' && target.dataset.listen) {
        if (this.audioState.phase === 'choices') this.playSound(sounds[Number(target.dataset.listen)]);
        return;
      }
      if (this.game === 'audio' && target.dataset.answer) return this.answerAudio(Number(target.dataset.answer));
    }

    destroy() {
      this.stop();
      this.host.removeEventListener('click', this.onClick);
      this.host.removeEventListener('dragstart', this.onDragStart);
      this.host.removeEventListener('dragover', this.onDragOver);
      this.host.removeEventListener('drop', this.onDrop);
      delete this.host.focusPlanetDemos;
      this.host.innerHTML = '';
      this.host.classList.remove('fpd');
    }
  }

  function mountAll() {
    document.querySelectorAll('[data-focus-planet-demos]').forEach(host => {
      if (!host.focusPlanetDemos) host.focusPlanetDemos = new FocusPlanetDemos(host);
    });
  }
  window.FocusPlanetDemos = { mount: host => host.focusPlanetDemos || (host.focusPlanetDemos = new FocusPlanetDemos(host)), mountAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll, { once: true });
  else mountAll();
})();

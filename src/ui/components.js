// All HTML overlay components. Small classes over plain DOM — no framework.

function el(tag, className, parent, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  parent?.appendChild(node);
  return node;
}

export class Toolbar {
  constructor(root, pointer, undo, tools, bus) {
    this.node = el('div', 'ui toolbar', root);
    const mk = (id, label, chip) => {
      const b = el('button', '', this.node,
        `${chip ? `<span class="chip ${chip}"></span>` : ''}${label}`);
      b.addEventListener('click', () => this.select(id));
      return b;
    };
    this.buttons = {
      sand: mk('sand', 'Sand', 'sand'),
      clay: mk('clay', 'Clay', 'clay'),
      stone: mk('stone', 'Stone', 'stone'),
      smooth: mk('smooth', 'Smooth'),
      remove: mk('remove', 'Erase'),
    };
    el('div', 'sep', this.node);
    el('span', 'size-label', this.node, 'Brush');
    this.slider = el('input', '', this.node);
    this.slider.type = 'range';
    this.slider.min = '2'; this.slider.max = '10'; this.slider.value = String(pointer.brushRadius);
    this.slider.addEventListener('input', () => { pointer.brushRadius = Number(this.slider.value); });
    el('div', 'sep', this.node);
    const undoBtn = el('button', '', this.node, 'Undo');
    undoBtn.addEventListener('click', () => undo.undo());
    const clearBtn = el('button', '', this.node, 'Clear All');
    clearBtn.addEventListener('click', () => tools.clearAll());

    this.pointer = pointer;
    this.select('sand');

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const keys = { 1: 'sand', 2: 'clay', 3: 'stone', 4: 'smooth', 5: 'remove' };
      if (keys[e.key]) this.select(keys[e.key]);
      if (e.key === '[') this.bump(-1);
      if (e.key === ']') this.bump(1);
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo.undo(); }
    });
    bus.on('phase-changed', ({ phase }) => this.setVisible(phase === 'build'));
  }

  bump(d) {
    this.slider.value = String(Math.min(10, Math.max(2, Number(this.slider.value) + d)));
    this.pointer.brushRadius = Number(this.slider.value);
  }

  select(id) {
    this.pointer.activeTool = id;
    for (const [k, b] of Object.entries(this.buttons)) b.classList.toggle('active', k === id);
  }

  setVisible(v) { this.node.style.display = v ? 'flex' : 'none'; }
}

export class BudgetPanel {
  constructor(root, budget, bus) {
    this.node = el('div', 'ui budget', root, '<h3>Materials</h3>');
    this.rows = {};
    for (const [mat, label] of [['sand', 'Sand'], ['clay', 'Clay'], ['stone', 'Stone']]) {
      const row = el('div', `row ${mat}`, this.node,
        `<span style="width:44px">${label}</span><span class="bar"><i></i></span><span class="num"></span>`);
      this.rows[mat] = { fill: row.querySelector('i'), num: row.querySelector('.num') };
    }
    this.update(budget.snapshot());
    bus.on('budget-changed', (snap) => this.update(snap));
  }

  update({ total, left }) {
    for (const mat of ['sand', 'clay', 'stone']) {
      const t = total[mat], l = left[mat];
      this.rows[mat].fill.style.width = t > 0 ? `${(l / t) * 100}%` : '0%';
      this.rows[mat].num.textContent = mat === 'stone' ? `${Math.floor(l)}/${t}` : `${Math.round(l)}`;
    }
  }
}

export class PhaseControls {
  constructor(root, gameLoop, bus, sound) {
    this.node = el('div', 'ui phase', root);
    this.releaseBtn = el('button', 'btn-release', this.node, 'Release the Water');
    this.ffBtn = el('button', 'btn-small', this.node, '2× speed');
    this.ffBtn.style.display = 'none';
    this.releaseBtn.addEventListener('click', () => {
      sound.init();
      sound.release();
      gameLoop.releaseWater();
    });
    this.ffBtn.addEventListener('click', () => {
      gameLoop.fastForward = !gameLoop.fastForward;
      this.ffBtn.classList.toggle('active', gameLoop.fastForward);
    });
    bus.on('phase-changed', ({ phase }) => {
      this.releaseBtn.style.display = phase === 'build' ? 'block' : 'none';
      this.ffBtn.style.display = phase === 'flood' ? 'block' : 'none';
      if (phase !== 'flood') this.ffBtn.classList.remove('active');
    });
  }
}

export class Timeline {
  constructor(root, level, bus) {
    this.node = el('div', 'ui timeline', root,
      '<div class="track"><div class="emit-zone"></div><div class="fill"></div></div><div class="lbl"></div>');
    this.fill = this.node.querySelector('.fill');
    this.lbl = this.node.querySelector('.lbl');
    const total = level.source.duration + level.settleTime;
    this.node.querySelector('.emit-zone').style.width = `${(level.source.duration / total) * 100}%`;
    bus.on('phase-changed', ({ phase }) => this.node.classList.toggle('visible', phase === 'flood'));
    bus.on('flood-progress', ({ simTime, duration, emitRemaining }) => {
      this.fill.style.width = `${Math.min(100, (simTime / duration) * 100)}%`;
      this.lbl.textContent = emitRemaining > 0 ? 'The water is coming…' : 'Settling…';
    });
  }
}

export class VerdictModal {
  constructor(root, { gameLoop, level, progress, bus, sound, onNext, onLevels }) {
    this.wrap = el('div', 'ui verdict-wrap', root);
    this.box = el('div', 'verdict', this.wrap);
    bus.on('phase-changed', ({ phase, verdict }) => {
      if (phase !== 'verdict') { this.wrap.classList.remove('visible'); return; }
      this.show(verdict);
    });
    this.gameLoop = gameLoop;
    this.level = level;
    this.progress = progress;
    this.sound = sound;
    this.onNext = onNext;
    this.onLevels = onLevels;
  }

  show(v) {
    const b = this.box;
    b.className = `verdict ${v.won ? 'win' : 'loss'}`;
    if (v.won) {
      this.sound.win();
      this.progress.record(this.level.id, v.stars);
      b.innerHTML = `
        <h2>All houses safe</h2>
        <div class="stars">${'★'.repeat(v.stars)}${'☆'.repeat(3 - v.stars)}</div>
        <p>The water came, and your defence held.</p>
        ${v.stars < 3 ? '<p class="advice">A leaner build earns more stars.</p>' : '<p class="advice">A perfect defence.</p>'}
        <div class="actions">
          <button class="primary" data-act="next">Next Level</button>
          <button class="secondary" data-act="retry">Build Again</button>
          <button class="secondary" data-act="levels">Levels</button>
        </div>`;
    } else {
      this.sound.lose();
      b.innerHTML = `
        <h2>${v.houseName ?? 'A house'} flooded</h2>
        <p>${v.label}</p>
        <p class="advice">${v.advice}</p>
        <p style="opacity:0.6;font-size:12px">Your build is preserved — fix the weak spot and try again.</p>
        <div class="actions">
          <button class="primary" data-act="retry">Try Again</button>
          <button class="secondary" data-act="levels">Levels</button>
        </div>`;
    }
    b.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      this.wrap.classList.remove('visible');
      if (act === 'retry') this.gameLoop.retry();
      else if (act === 'next') this.onNext();
      else if (act === 'levels') this.onLevels();
    }));
    this.wrap.classList.add('visible');
  }
}

export class LevelSelect {
  constructor(root, levels, progress, onPick) {
    this.node = el('div', 'ui level-select', root);
    el('h1', '', this.node, 'Dam-Orama');
    el('div', 'sub', this.node, 'Shape the land. Hold back the water. Keep the lights on.');
    this.cardsNode = el('div', 'cards', this.node);
    this.levels = levels;
    this.progress = progress;
    this.onPick = onPick;
  }

  show() {
    this.cardsNode.innerHTML = '';
    for (const level of this.levels) {
      const unlocked = this.progress.isUnlocked(this.levels, level.id);
      const stars = this.progress.starsFor(level.id);
      const card = el('div', `card${unlocked ? '' : ' locked'}`, this.cardsNode, `
        <h3>${level.name}</h3>
        <div class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <p>${level.tagline}</p>
        ${unlocked ? '' : '<div class="lock">Win the previous level to unlock</div>'}`);
      if (unlocked) card.addEventListener('click', () => { this.hide(); this.onPick(level); });
    }
    this.node.classList.add('visible');
  }

  hide() { this.node.classList.remove('visible'); }
}

export class HintToast {
  constructor(root, level, bus) {
    this.btn = el('button', 'ui hint-btn', root, '?');
    this.toast = el('div', 'ui hint-toast', root, level.hint);
    this.btn.addEventListener('click', () => this.toast.classList.toggle('visible'));
    bus.on('phase-changed', () => this.toast.classList.remove('visible'));
    el('div', 'ui level-badge', root,
      `<div class="name">${level.name}</div><div class="tagline">${level.tagline}</div>`);
  }
}

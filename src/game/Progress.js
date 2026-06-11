const KEY = 'damorama.progress.v1';

// Stars per level id, persisted to localStorage. Levels unlock in order.
export class Progress {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.stars = {};
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) this.stars = JSON.parse(raw);
    } catch { /* fresh start */ }
  }

  starsFor(levelId) {
    return this.stars[levelId] ?? 0;
  }

  record(levelId, stars) {
    if (stars > this.starsFor(levelId)) {
      this.stars[levelId] = stars;
      try { this.storage?.setItem(KEY, JSON.stringify(this.stars)); } catch { /* private mode */ }
    }
  }

  isUnlocked(levels, levelId) {
    const idx = levels.findIndex((l) => l.id === levelId);
    if (idx <= 0) return true;
    return this.starsFor(levels[idx - 1].id) > 0;
  }
}

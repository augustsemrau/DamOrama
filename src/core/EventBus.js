export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(fn);
  }

  off(event, fn) {
    const list = this._listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit(event, data) {
    const list = this._listeners.get(event);
    if (!list) return;
    for (const fn of list) fn(data);
  }
}

// Material budgets in volume units (sum of placed heights); stone in blocks.
export class Budget {
  constructor(budgets, bus = null) {
    this.total = { ...budgets };
    this.left = { ...budgets };
    this.bus = bus;
  }

  // Returns the amount actually grantable (callers clamp their op to this).
  available(mat) {
    return this.left[mat] ?? 0;
  }

  spend(mat, amount) {
    const granted = Math.min(amount, this.left[mat]);
    if (granted > 0) {
      this.left[mat] -= granted;
      this.bus?.emit('budget-changed', this.snapshot());
    }
    return granted;
  }

  refund(mat, amount) {
    if (amount <= 0) return;
    this.left[mat] = Math.min(this.total[mat], this.left[mat] + amount);
    this.bus?.emit('budget-changed', this.snapshot());
  }

  snapshot() {
    return { total: { ...this.total }, left: { ...this.left } };
  }

  restore(snap) {
    this.left = { ...snap.left };
    this.bus?.emit('budget-changed', this.snapshot());
  }

  reset() {
    this.left = { ...this.total };
    this.bus?.emit('budget-changed', this.snapshot());
  }
}

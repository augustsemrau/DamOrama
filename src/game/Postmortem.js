// Breach analysis (heuristic, not path-traced — spec §8). Reads the flood
// stats the Erosion pass recorded and names one actionable cause + spot.
export function analyzeBreach(grid, erosion, winLoss, level) {
  const first = winLoss.firstFlooded();
  const houseName = first
    ? level.houses.find((h) => h.id === first.id)?.name ?? first.id
    : null;

  // 1. Erosion breach: the defence cell that lost the most height.
  let bestEro = 0, eroCell = -1;
  for (let i = 0; i < grid.cellCount; i++) {
    if (erosion.erosionTotal[i] > bestEro) {
      bestEro = erosion.erosionTotal[i];
      eroCell = i;
    }
  }
  if (bestEro > 0.06) {
    return {
      cause: 'eroded',
      cell: eroCell,
      houseName,
      label: `${houseName} flooded — the water wore through here.`,
      advice: 'Sand washes away under fast flow. Armor this spot with clay or stone.',
    };
  }

  // 2. Overtopping: deepest water that stood on top of placed material.
  let bestOver = 0, overCell = -1;
  for (let i = 0; i < grid.cellCount; i++) {
    if (erosion.maxOvertop[i] > bestOver) {
      bestOver = erosion.maxOvertop[i];
      overCell = i;
    }
  }
  if (bestOver > 0.02) {
    return {
      cause: 'overtopped',
      cell: overCell,
      houseName,
      label: `${houseName} flooded — the water rose over your wall here.`,
      advice: 'The crest is too low. Build higher, or give the water somewhere else to go.',
    };
  }

  // 3. Never blocked: fastest flow near the first flooded house.
  let cell = -1;
  if (first) {
    let best = -1;
    const R = 14;
    const hx = first.x + first.w / 2, hy = first.y + first.h / 2;
    for (let y = Math.max(0, hy - R); y < Math.min(grid.height, hy + R); y++) {
      for (let x = Math.max(0, hx - R); x < Math.min(grid.width, hx + R); x++) {
        const i = grid.index(Math.floor(x), Math.floor(y));
        if (erosion.maxSpeed[i] > best) {
          best = erosion.maxSpeed[i];
          cell = i;
        }
      }
    }
  }
  return {
    cause: 'unblocked',
    cell,
    houseName,
    label: houseName
      ? `${houseName} flooded — the water was never blocked.`
      : 'The water was never blocked.',
    advice: 'Nothing stood in the flow path. Put a wall between the source and the houses.',
  };
}

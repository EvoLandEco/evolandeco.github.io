export function coveragePositions(original: number[], selected: Set<number>, anchor: number, height: number) {
  if (!selected.size) return original;
  const members = original.map((_, i) => i).filter(i => selected.has(i));
  const rest = original.map((_, i) => i).filter(i => !selected.has(i));
  const before = rest.filter(i => original[i] < anchor);
  const after = rest.filter(i => original[i] >= anchor);
  const order = [...before, ...members, ...after];
  const targets = new Map(members.map((id, i) => [id, anchor + (i - (members.length - 1) / 2) * 54]));
  const blocks: { start: number; sum: number; count: number }[] = [];
  // Isotonic regression minimizes displacement while keeping 54px between nodes.
  order.forEach((id, i) => {
    blocks.push({ start: i, sum: (targets.get(id) ?? original[id]) - i * 54, count: 1 });
    while (blocks.length > 1) {
      const a = blocks.at(-2)!, b = blocks.at(-1)!;
      if (a.sum / a.count <= b.sum / b.count) break;
      a.sum += b.sum; a.count += b.count; blocks.pop();
    }
  });
  const positions = [...original];
  for (const block of blocks) {
    const base = Math.max(40, Math.min(height - 40 - (original.length - 1) * 54, block.sum / block.count));
    for (let i = block.start; i < block.start + block.count; i++) positions[order[i]] = base + i * 54;
  }
  return positions;
}

export function revealAtlasEntries(container: HTMLElement | null, ids: string[], headingHeight = 0) {
  if (!container || container.scrollHeight <= container.clientHeight) return;
  const entries = Array.from(container.querySelectorAll<HTMLElement>("[data-entry-id]"))
    .filter(entry => ids.includes(entry.dataset.entryId!));
  if (!entries.length) return;
  const frame = container.getBoundingClientRect();
  const padding = parseFloat(getComputedStyle(container).paddingTop);
  const top = frame.top + container.clientTop + padding + headingHeight;
  const bottom = frame.top + container.clientTop + container.clientHeight - padding;
  const boxes = entries.map(entry => entry.getBoundingClientRect());
  let start = Math.min(...boxes.map(box => box.top));
  let end = Math.max(...boxes.map(box => box.bottom));
  if (end - start > bottom - top) { start = boxes[0].top; end = boxes[0].bottom; }
  if (start < top) container.scrollTop += start - top;
  else if (end > bottom) container.scrollTop += Math.min(end - bottom, start - top);
}

type Bounds = { top: number; right: number; bottom: number; left: number };
type Clips = { viewport: Bounds; parts: Map<string, { box: DOMRect; bounds: Bounds }> };

function clipAncestors(bounds: Bounds, parent: HTMLElement | null, stop: HTMLElement | null) {
  for (; parent && parent !== stop; parent = parent.parentElement) {
    const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
    if (style.overflowX !== 'visible') {
      bounds.left = Math.max(bounds.left, rect.left + parent.clientLeft);
      bounds.right = Math.min(bounds.right, rect.left + parent.clientLeft + parent.clientWidth);
    }
    if (style.overflowY !== 'visible') {
      bounds.top = Math.max(bounds.top, rect.top + parent.clientTop);
      bounds.bottom = Math.min(bounds.bottom, rect.top + parent.clientTop + parent.clientHeight);
    }
  }
  return bounds;
}

export function cardTransitionClips(card: HTMLElement): Clips {
  const toolbar = card.closest('.atlas-analysis')?.querySelector<HTMLElement>(':scope > header');
  const viewport = clipAncestors({ top: Math.max(0, toolbar?.getBoundingClientRect().bottom ?? 0), right: innerWidth, bottom: innerHeight, left: 0 }, card.parentElement, null);
  const parts: Clips['parts'] = new Map();
  const { top, right, bottom, left } = card.getBoundingClientRect();
  for (const element of [card, ...card.querySelectorAll<HTMLElement>('[style*="view-transition-name"]')]) {
    parts.set(element.style.viewTransitionName, { box: element.getBoundingClientRect(), bounds: clipAncestors({ top, right, bottom, left }, element.parentElement, card.parentElement) });
  }
  return { viewport, parts };
}

function inset(frame: Clips, name: string, viewport: Bounds) {
  const { box, bounds } = frame.parts.get(name)!;
  const top = Math.max(bounds.top, frame.viewport.top, viewport.top);
  const right = Math.min(bounds.right, frame.viewport.right, viewport.right);
  const bottom = Math.min(bounds.bottom, frame.viewport.bottom, viewport.bottom);
  const left = Math.max(bounds.left, frame.viewport.left, viewport.left);
  return `inset(${Math.max(0, top - box.top)}px ${Math.max(0, box.right - right)}px ${Math.max(0, box.bottom - bottom)}px ${Math.max(0, left - box.left)}px)`;
}

export function clipCardTransition(transition: ViewTransition, before: Clips, after: () => Clips) {
  const clips: Animation[] = [];
  let cancelled = false;
  void transition.ready.then(() => {
    if (cancelled) return;
    const target = after();
    for (const animation of document.getAnimations()) {
      const effect = animation.effect;
      if (!(effect instanceof KeyframeEffect)) continue;
      const name = effect.pseudoElement?.match(/^::view-transition-group\((.+)\)$/)?.[1];
      if (!name || !before.parts.has(name) || !target.parts.has(name)) continue;
      // The page snapshot uses the destination viewport while the card layers move.
      const frames = effect.getKeyframes();
      const clip = document.documentElement.animate([{ clipPath: inset(before, name, target.viewport), easing: frames[0].easing }, { clipPath: inset(target, name, target.viewport), easing: frames.at(-1)!.easing }], { ...effect.getTiming(), pseudoElement: effect.pseudoElement });
      clip.id = 'atlas-card-clip';
      clips.push(clip);
      // Pending CSS animations receive their start time on the next render frame.
      void Promise.all([animation.ready, clip.ready]).then(() => {
        if (cancelled) return;
        if (animation.playState === 'paused') { clip.pause(); clip.currentTime = animation.currentTime; }
        else clip.startTime = animation.startTime;
      }, () => clip.cancel());
    }
  }, () => {});
  return () => { cancelled = true; clips.forEach(animation => animation.cancel()); };
}

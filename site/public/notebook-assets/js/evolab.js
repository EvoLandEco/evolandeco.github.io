(function () {
  const root = document.getElementById('evonet-simulator');
  if (!root || typeof d3 === 'undefined') return;

  const $ = (id) => document.getElementById(id);
  const dom = {
    birthRate: $('birthRate'),
    birthRateValue: $('birthRateValue'),
    mutateRate: $('mutateRate'),
    mutateRateValue: $('mutateRateValue'),
    deathRate: $('deathRate'),
    deathRateValue: $('deathRateValue'),
    maxSteps: $('maxSteps'),
    maxStepsValue: $('maxStepsValue'),
    mstep: $('mstep'),
    mstepValue: $('mstepValue'),
    traitDimensions: $('traitDimensions'),
    traitDimensionsValue: $('traitDimensionsValue'),
    traitSigma: $('traitSigma'),
    traitSigmaValue: $('traitSigmaValue'),
    traitModel: $('traitModel'),
    ouAlpha: $('ouAlpha'),
    ouAlphaValue: $('ouAlphaValue'),
    ouAlphaWrapper: $('ouAlphaWrapper'),
    pruneExtinct: $('pruneExtinct'),
    showBranchLengths: $('showBranchLengths'),
    seedInput: $('seedInput'),
    randomSeedButton: $('randomSeedButton'),
    presetSelect: $('presetSelect'),
    presetDescription: $('presetDescription'),
    startButton: $('startButton'),
    pauseButton: $('pauseButton'),
    stepButton: $('stepButton'),
    resetButton: $('resetButton'),
    exportJsonButton: $('exportJsonButton'),
    copyHistoryNewickButton: $('copyHistoryNewickButton'),
    copyTraitNewickButton: $('copyTraitNewickButton'),
    graphContainer: $('graph-container'),
    coarsenedContainer: $('coarsened-graph-container'),
    historyTreeContainer: $('plot-container'),
    traitTreeContainer: $('trait-container'),
    lttContainer: $('ltt-container'),
    traitSpaceContainer: $('trait-space-container'),
    extantCount: $('extantCount'),
    extinctCount: $('extinctCount'),
    observedCount: $('observedCount'),
    timeCount: $('timeCount'),
    agreementCount: $('agreementCount'),
    statusNote: $('statusNote'),
    eventFeed: $('eventFeed'),
    summaryRatesChip: $('summaryRatesChip'),
    summaryCoarsenChip: $('summaryCoarsenChip'),
    summaryTraitChip: $('summaryTraitChip'),
    eventDrawerButton: $('eventDrawerButton'),
    eventDrawerCloseButton: $('eventDrawerCloseButton'),
    eventDrawerBackdrop: $('eventDrawerBackdrop'),
    eventDrawer: $('eventDrawer'),
    darkModeToggle: $('darkmode'),
    themeStyle: $('theme-style')
  };

  const presets = {
    balanced: {
      label: 'Balanced exploration',
      description: 'A middle-of-the-road setting. Useful for seeing the whole pipeline without everything exploding or dying immediately.',
      values: {
        birthRate: 0.40,
        mutateRate: 0.35,
        deathRate: 0.10,
        maxSteps: 40,
        mstep: 2,
        traitDimensions: 4,
        traitSigma: 0.50,
        traitModel: 'brownian',
        ouAlpha: 0.25,
        seed: 182734
      }
    },
    turnover: {
      label: 'High turnover',
      description: 'More extinction, more ambiguity. Good for watching reconstructed history lose information.',
      values: {
        birthRate: 0.28,
        mutateRate: 0.34,
        deathRate: 0.34,
        maxSteps: 45,
        mstep: 2,
        traitDimensions: 5,
        traitSigma: 0.45,
        traitModel: 'brownian',
        ouAlpha: 0.25,
        seed: 927441
      }
    },
    radiation: {
      label: 'Rapid radiation',
      description: 'Many daughters in a short time. The trait tree can look clean even when the event history is awkward.',
      values: {
        birthRate: 0.62,
        mutateRate: 0.50,
        deathRate: 0.08,
        maxSteps: 50,
        mstep: 1,
        traitDimensions: 6,
        traitSigma: 0.65,
        traitModel: 'brownian',
        ouAlpha: 0.25,
        seed: 49031
      }
    },
    constrained: {
      label: 'Trait constraint (OU-like)',
      description: 'Diversification keeps going, but trait evolution is pulled back toward an optimum, so the trait cloud stays tighter.',
      values: {
        birthRate: 0.42,
        mutateRate: 0.35,
        deathRate: 0.12,
        maxSteps: 45,
        mstep: 2,
        traitDimensions: 4,
        traitSigma: 0.35,
        traitModel: 'ou',
        ouAlpha: 0.30,
        seed: 550217
      }
    }
  };

  const palette = {
    blue: '#4264a6',
    red: '#d94f4f',
    grey: '#9aa3b2',
    text: '#2b2f38',
    softText: '#586172',
    accent: '#757ca3',
    light: '#f7f9fc',
    border: '#d9dfea',
    yellow: '#f7d724',
    green: '#3aa675',
    axis: '#c8d0dd',
    axisGrid: '#d6dbe6',
    axisGridStrong: '#d8deea',
    axisGuide: '#c2c9d8',
    connector: '#b7c0d0',
    treeGuide: '#c7cddd',
    treeLink: '#2f3441',
    treeNode: '#5c6577',
    nodeRing: '#ffffff',
    totalLineages: '#c06a2b'
  };

  const state = {
    nodes: [],
    nodeById: new Map(),
    activeIds: new Set(),
    step: 0,
    time: 0,
    nextId: 1,
    running: false,
    timer: null,
    rng: Math.random,
    playbackMs: 340,
    eventLog: [],
    timeSeries: [],
    derived: {
      coarsened: null,
      historyNewick: null,
      traitNewick: null,
      observedRecords: [],
      agreement: null,
      traitProjection: []
    },
    highlightRecordId: null,
    settings: null,
    eventDrawerOpen: false,
    drawerTimer: null,
    lastRenderedBranchLengthMode: null,
    themeDark: null
  };

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randn(rng) {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function sampleExponential(rate, rng) {
    if (!Number.isFinite(rate) || rate <= 0) return 0;
    const u = Math.max(rng(), 1e-12);
    return -Math.log(1 - u) / rate;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatNum(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(value)) return '–';
    return Number(value).toFixed(digits);
  }

  function debounce(fn, delay) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function maybeTransition(selection, transition) {
    return transition ? selection.transition(transition) : selection;
  }

  function meanVector(vectors, dims) {
    if (!vectors.length) return Array(dims).fill(0);
    const out = Array(dims).fill(0);
    vectors.forEach((vec) => {
      for (let i = 0; i < dims; i += 1) out[i] += vec[i] || 0;
    });
    return out.map((v) => v / vectors.length);
  }

  function safeContainerSize(el, minHeight = 320) {
    const box = el.getBoundingClientRect();
    return {
      width: Math.max(320, box.width || 320),
      height: Math.max(minHeight, box.height || minHeight)
    };
  }

  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        window.prompt('Copy this text:', text);
      });
    } else {
      window.prompt('Copy this text:', text);
    }
  }

  function readThemeValue(name, fallback) {
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
  }

  function refreshPalette() {
    palette.blue = readThemeValue('--sim-blue', palette.blue);
    palette.red = readThemeValue('--sim-red', palette.red);
    palette.grey = readThemeValue('--sim-grey', palette.grey);
    palette.text = readThemeValue('--sim-text', palette.text);
    palette.softText = readThemeValue('--sim-soft', palette.softText);
    palette.accent = readThemeValue('--sim-accent', palette.accent);
    palette.light = readThemeValue('--sim-bg', palette.light);
    palette.border = readThemeValue('--sim-border', palette.border);
    palette.yellow = readThemeValue('--sim-yellow', palette.yellow);
    palette.green = readThemeValue('--sim-green', palette.green);
    palette.axis = readThemeValue('--sim-axis', palette.axis);
    palette.axisGrid = readThemeValue('--sim-axis-grid', palette.axisGrid);
    palette.axisGridStrong = readThemeValue('--sim-axis-grid-strong', palette.axisGridStrong);
    palette.axisGuide = readThemeValue('--sim-axis-guide', palette.axisGuide);
    palette.connector = readThemeValue('--sim-connector', palette.connector);
    palette.treeGuide = readThemeValue('--sim-tree-guide', palette.treeGuide);
    palette.treeLink = readThemeValue('--sim-tree-link', palette.treeLink);
    palette.treeNode = readThemeValue('--sim-tree-node', palette.treeNode);
    palette.nodeRing = readThemeValue('--sim-node-ring', palette.nodeRing);
    palette.totalLineages = readThemeValue('--sim-total-lineages', palette.totalLineages);
  }

  function readStoredDarkPreference() {
    try {
      const keys = ['dark-mode', 'theme', 'theme-mode', 'color-theme'];
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value === null || value === undefined) continue;
        const normalized = String(value).trim().toLowerCase();
        if (['true', 'dark', '1'].includes(normalized)) return true;
        if (['false', 'light', '0'].includes(normalized)) return false;
      }
    } catch (error) {
      // ignore storage access errors
    }
    return null;
  }

  function inferDarkModeFromDocument() {
    const body = document.body;
    const html = document.documentElement;
    const themeHref = dom.themeStyle?.getAttribute('href') || '';
    const attrDark = [body, html].some((node) => {
      if (!node) return false;
      const dataTheme = (node.getAttribute('data-theme') || '').toLowerCase();
      const dataBsTheme = (node.getAttribute('data-bs-theme') || '').toLowerCase();
      return dataTheme === 'dark' || dataBsTheme === 'dark';
    });
    const classDark = [body, html].some((node) => {
      if (!node) return false;
      return ['dark', 'dark-mode', 'theme-dark'].some((cls) => node.classList.contains(cls));
    });
    if (attrDark || classDark || /dark/i.test(themeHref)) return true;
    if (dom.darkModeToggle) return dom.darkModeToggle.checked;
    const storedPreference = readStoredDarkPreference();
    if (storedPreference !== null) return storedPreference;
    if (window.matchMedia) return window.matchMedia('(prefers-color-scheme: dark)').matches;
    return false;
  }

  function syncThemeWithPage(force = false) {
    const dark = inferDarkModeFromDocument();
    if (!force && state.themeDark === dark) return;
    state.themeDark = dark;
    if (document.body) {
      document.body.classList.toggle('sim-article-dark', dark);
    }
    root.classList.toggle('sim-theme-dark', dark);
    root.dataset.simTheme = dark ? 'dark' : 'light';
    refreshPalette();
    if (state.settings) renderAll();
    document.dispatchEvent(new CustomEvent('evonet:themechange', { detail: { dark } }));
  }

  function bindThemeSync() {
    const syncSoon = debounce(() => syncThemeWithPage(), 24);

    if (dom.darkModeToggle) {
      ['change', 'input', 'click'].forEach((eventName) => {
        dom.darkModeToggle.addEventListener(eventName, () => syncSoon());
      });
    }

    if (dom.themeStyle) {
      new MutationObserver(() => syncSoon()).observe(dom.themeStyle, {
        attributes: true,
        attributeFilter: ['href']
      });
    }

    if (document.body) {
      new MutationObserver(() => syncSoon()).observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'data-bs-theme']
      });
    }

    new MutationObserver(() => syncSoon()).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-bs-theme']
    });

    if (window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      if (media.addEventListener) {
        media.addEventListener('change', () => syncSoon());
      } else if (media.addListener) {
        media.addListener(() => syncSoon());
      }
    }

    window.addEventListener('load', () => syncThemeWithPage(true));
    requestAnimationFrame(() => syncThemeWithPage(true));
    setTimeout(() => syncThemeWithPage(true), 120);
  }

  function syncValueSpans() {
    dom.birthRateValue.textContent = formatNum(dom.birthRate.value, 2);
    dom.mutateRateValue.textContent = formatNum(dom.mutateRate.value, 2);
    dom.deathRateValue.textContent = formatNum(dom.deathRate.value, 2);
    dom.maxStepsValue.textContent = dom.maxSteps.value;
    dom.mstepValue.textContent = dom.mstep.value;
    dom.traitDimensionsValue.textContent = dom.traitDimensions.value;
    dom.traitSigmaValue.textContent = formatNum(dom.traitSigma.value, 2);
    dom.ouAlphaValue.textContent = formatNum(dom.ouAlpha.value, 2);
    dom.ouAlphaWrapper.hidden = dom.traitModel.value !== 'ou';
    const preset = presets[dom.presetSelect.value];
    if (preset && dom.presetDescription) dom.presetDescription.textContent = preset.description;

    if (dom.summaryRatesChip) {
      dom.summaryRatesChip.textContent = `Rates ${formatNum(dom.birthRate.value, 2)} / ${formatNum(dom.mutateRate.value, 2)} / ${formatNum(dom.deathRate.value, 2)}`;
    }
    if (dom.summaryCoarsenChip) {
      const pruneText = dom.pruneExtinct.checked ? ' · prune' : '';
      const branchText = dom.showBranchLengths.checked ? ' · lengths' : '';
      dom.summaryCoarsenChip.textContent = `Coarsen ${dom.mstep.value}${pruneText}${branchText}`;
    }
    if (dom.summaryTraitChip) {
      const traitModelText = dom.traitModel.value === 'ou'
        ? `OU α ${formatNum(dom.ouAlpha.value, 2)}`
        : 'Brownian';
      dom.summaryTraitChip.textContent = `${traitModelText} · ${dom.traitDimensions.value}D`;
    }
  }

  function cacheSettings() {
    return {
      birthRate: parseFloat(dom.birthRate.value),
      mutateRate: parseFloat(dom.mutateRate.value),
      deathRate: parseFloat(dom.deathRate.value),
      maxSteps: parseInt(dom.maxSteps.value, 10),
      coarsenLevel: parseInt(dom.mstep.value, 10),
      traitDimensions: parseInt(dom.traitDimensions.value, 10),
      traitSigma: parseFloat(dom.traitSigma.value),
      traitModel: dom.traitModel.value,
      ouAlpha: parseFloat(dom.ouAlpha.value),
      pruneExtinct: dom.pruneExtinct.checked,
      showBranchLengths: dom.showBranchLengths.checked,
      seed: parseInt(dom.seedInput.value, 10) || 1
    };
  }

  function updateButtonState() {
    dom.startButton.disabled = state.running;
    dom.pauseButton.disabled = !state.running;
    dom.stepButton.disabled = state.running;
  }

  function updateControlLocks() {
    const lockHistorical = state.step > 0 || state.running;
    dom.maxSteps.disabled = lockHistorical;
    dom.traitDimensions.disabled = lockHistorical;
    dom.traitSigma.disabled = lockHistorical;
    dom.traitModel.disabled = lockHistorical;
    dom.ouAlpha.disabled = lockHistorical;
    dom.seedInput.disabled = lockHistorical;
    dom.randomSeedButton.disabled = lockHistorical;
    dom.presetSelect.disabled = lockHistorical;
  }

  function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    const v = preset.values;
    dom.birthRate.value = v.birthRate;
    dom.mutateRate.value = v.mutateRate;
    dom.deathRate.value = v.deathRate;
    dom.maxSteps.value = v.maxSteps;
    dom.mstep.value = v.mstep;
    dom.traitDimensions.value = v.traitDimensions;
    dom.traitSigma.value = v.traitSigma;
    dom.traitModel.value = v.traitModel;
    dom.ouAlpha.value = v.ouAlpha;
    dom.seedInput.value = v.seed;
    syncValueSpans();
    if (state.step === 0 && !state.running) resetSimulation();
  }

  function randomizeSeed() {
    dom.seedInput.value = Math.floor(Math.random() * 1000000000);
    if (state.step === 0 && !state.running) resetSimulation();
  }

  function rebuildNodeMap() {
    state.nodeById = new Map(state.nodes.map((n) => [n.id, n]));
  }

  function getNodeEndTime(node) {
    return node.active ? state.time : node.extinctTime;
  }

  function createNode({ id, parentId, birthTime, mutated, trait, eventType }) {
    return {
      id,
      parentId,
      birthTime,
      extinctTime: null,
      active: true,
      mutated,
      eventType,
      trait,
      children: []
    };
  }

  function mutateTraits(parentTrait) {
    const dims = state.settings.traitDimensions;
    const sigma = state.settings.traitSigma;
    const model = state.settings.traitModel;
    const alpha = clamp(state.settings.ouAlpha, 0, 1);
    if (model === 'ou') {
      return parentTrait.map((v) => v + alpha * (0 - v) + randn(state.rng) * sigma);
    }
    return parentTrait.map((v) => v + randn(state.rng) * sigma);
  }

  function resetSimulation() {
    pauseSimulation();
    syncValueSpans();
    state.settings = cacheSettings();
    state.rng = mulberry32(state.settings.seed);
    state.step = 0;
    state.time = 0;
    state.nextId = 1;
    state.activeIds = new Set();
    state.eventLog = [];
    state.timeSeries = [];
    state.highlightRecordId = null;

    const rootNode = createNode({
      id: 1,
      parentId: null,
      birthTime: 0,
      mutated: false,
      trait: Array(state.settings.traitDimensions).fill(0),
      eventType: 'root'
    });
    state.nodes = [rootNode];
    state.activeIds.add(1);
    rebuildNodeMap();
    pushTimeSeriesSnapshot('Initialized');
    recomputeDerived();
    renderAll();
    updateButtonState();
    updateControlLocks();
  }

  function startSimulation() {
    if (state.running) return;
    state.settings = cacheSettings();
    state.running = true;
    updateButtonState();
    updateControlLocks();
    tickLoop();
  }

  function tickLoop() {
    if (!state.running) return;
    state.timer = setTimeout(() => {
      simulateStep();
      if (state.running) tickLoop();
    }, state.playbackMs);
  }

  function pauseSimulation() {
    state.running = false;
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    updateButtonState();
    updateControlLocks();
  }

  function pickRandomActiveId() {
    const active = Array.from(state.activeIds);
    if (!active.length) return null;
    return active[Math.floor(state.rng() * active.length)];
  }

  function pushEvent(message) {
    state.eventLog.unshift(message);
    state.eventLog = state.eventLog.slice(0, 20);
  }

  function pushTimeSeriesSnapshot(label) {
    const coarsened = buildCoarsenedData();
    const observed = getObservedRecords(coarsened, state.settings.pruneExtinct);
    state.timeSeries.push({
      time: state.time,
      step: state.step,
      extantLineages: state.activeIds.size,
      totalLineages: state.nodes.length,
      extinctLineages: state.nodes.length - state.activeIds.size,
      observedSpecies: observed.length,
      label
    });
  }

  function simulateStep() {
    state.settings = cacheSettings();
    if (state.step >= state.settings.maxSteps) {
      pushEvent(`Stopped at step ${state.step}: reached the step limit.`);
      pauseSimulation();
      renderAll();
      return;
    }

    if (state.activeIds.size === 0) {
      pushEvent('All lineages are extinct.');
      pauseSimulation();
      renderAll();
      return;
    }

    const totalRate = (state.settings.birthRate + state.settings.mutateRate + state.settings.deathRate) * state.activeIds.size;
    if (totalRate <= 0) {
      pushEvent('All event rates are zero, so nothing else can happen.');
      pauseSimulation();
      renderAll();
      return;
    }

    const dt = sampleExponential(totalRate, state.rng);
    state.time += dt;
    state.step += 1;

    const focalId = pickRandomActiveId();
    const focal = state.nodeById.get(focalId);
    if (!focal) {
      pauseSimulation();
      return;
    }

    const roll = state.rng() * (state.settings.birthRate + state.settings.mutateRate + state.settings.deathRate);
    let eventType = 'death';
    if (roll < state.settings.birthRate) {
      eventType = 'birth';
    } else if (roll < state.settings.birthRate + state.settings.mutateRate) {
      eventType = 'mutation';
    }

    if (eventType === 'death') {
      focal.active = false;
      focal.extinctTime = state.time;
      state.activeIds.delete(focal.id);
      pushEvent(`t = ${formatNum(state.time)}: lineage ${focal.id} went extinct.`);
    } else {
      state.nextId += 1;
      const childId = state.nextId;
      const trait = eventType === 'mutation' ? mutateTraits(focal.trait) : focal.trait.slice();
      const child = createNode({
        id: childId,
        parentId: focal.id,
        birthTime: state.time,
        mutated: eventType === 'mutation',
        trait,
        eventType
      });
      focal.children.push(childId);
      state.nodes.push(child);
      state.activeIds.add(childId);
      state.nodeById.set(childId, child);
      pushEvent(`t = ${formatNum(state.time)}: ${eventType === 'mutation' ? 'mutating' : 'clonal'} daughter ${childId} budded from ${focal.id}.`);
    }

    pushTimeSeriesSnapshot(eventType);
    recomputeDerived();
    renderAll();

    if (state.step >= state.settings.maxSteps || state.activeIds.size === 0) {
      pauseSimulation();
    }
  }

  function buildChildrenMap(items) {
    const childMap = new Map();
    items.forEach((item) => childMap.set(item.id, []));
    items.forEach((item) => {
      if (item.parentId && childMap.has(item.parentId)) {
        childMap.get(item.parentId).push(item.id);
      }
    });
    childMap.forEach((children) => {
      children.sort((a, b) => {
        const aItem = items.find((d) => d.id === a);
        const bItem = items.find((d) => d.id === b);
        return (aItem?.birthTime || 0) - (bItem?.birthTime || 0) || a - b;
      });
    });
    return childMap;
  }

  function preorderIds(items) {
    const childMap = buildChildrenMap(items);
    const ordered = [];
    function visit(id) {
      ordered.push(id);
      const children = childMap.get(id) || [];
      children.forEach(visit);
    }
    if (items.some((d) => d.id === 1)) visit(1);
    return ordered;
  }

  function summarizeRecordTrait(record, nodeById) {
    const dims = state.settings.traitDimensions;
    const members = record.memberIds.map((id) => nodeById.get(id)).filter(Boolean);
    if (!members.length) return Array(dims).fill(0);

    let candidates = [];
    if (record.active) {
      candidates = members.filter((n) => n.active);
    }
    if (!candidates.length) {
      const maxEnd = d3.max(members, (n) => getNodeEndTime(n));
      candidates = members.filter((n) => Math.abs(getNodeEndTime(n) - maxEnd) < 1e-9);
    }
    if (!candidates.length) candidates = members;
    return meanVector(candidates.map((n) => n.trait), dims);
  }

  function buildCoarsenedData() {
    const nodeById = state.nodeById;
    const nodesOrdered = [...state.nodes].sort((a, b) => a.birthTime - b.birthTime || a.id - b.id);
    const recordByNode = new Map();
    const stepsSinceRecord = new Map();
    const recordMap = new Map();

    function ensureRecord(nodeId, parentRecordId) {
      if (!recordMap.has(nodeId)) {
        const node = nodeById.get(nodeId);
        recordMap.set(nodeId, {
          id: nodeId,
          parentId: parentRecordId || 0,
          birthTime: node.birthTime,
          endTime: node.birthTime,
          extinctTime: null,
          active: false,
          mutated: node.mutated,
          memberIds: []
        });
      }
      return recordMap.get(nodeId);
    }

    ensureRecord(1, 0);
    recordByNode.set(1, 1);
    stepsSinceRecord.set(1, 0);

    nodesOrdered.slice(1).forEach((node) => {
      const parentRecordId = recordByNode.get(node.parentId);
      const parentSteps = stepsSinceRecord.get(node.parentId) || 0;
      let steps = parentSteps + (node.mutated ? 1 : 0);
      let recordId = parentRecordId;

      if (state.settings.coarsenLevel === 0 || (node.mutated && steps >= state.settings.coarsenLevel)) {
        recordId = node.id;
        ensureRecord(node.id, parentRecordId);
        steps = 0;
      }

      recordByNode.set(node.id, recordId);
      stepsSinceRecord.set(node.id, steps);
    });

    nodesOrdered.forEach((node) => {
      const recordId = recordByNode.get(node.id);
      const record = recordMap.get(recordId);
      if (!record) return;
      record.memberIds.push(node.id);
      record.endTime = Math.max(record.endTime, getNodeEndTime(node));
      if (node.active) record.active = true;
    });

    const records = Array.from(recordMap.values()).sort((a, b) => a.birthTime - b.birthTime || a.id - b.id);
    records.forEach((record) => {
      record.extinctTime = record.active ? null : record.endTime;
      record.observedTrait = summarizeRecordTrait(record, nodeById);
      record.displayColor = record.active ? (record.mutated ? palette.red : palette.blue) : palette.grey;
    });

    const links = records
      .filter((record) => record.parentId && record.parentId !== 0)
      .map((record) => ({ source: record.parentId, target: record.id }));

    const lTable = records.map((record) => ({
      eventTime: record.birthTime,
      parentId: record.parentId || 0,
      childId: record.id,
      extinctTime: record.active ? -1 : record.endTime
    }));

    return { records, links, recordByNode, lTable };
  }

  function getObservedRecords(coarsened, pruneExtinct) {
    let records = coarsened.records;
    if (pruneExtinct) {
      records = records.filter((record) => record.active);
    }
    return records;
  }

  function calculateDistanceMatrix(traitTable) {
    const ids = Object.keys(traitTable);
    const matrix = [];
    for (let i = 0; i < ids.length; i += 1) {
      const row = [];
      for (let j = 0; j < ids.length; j += 1) {
        if (i === j) {
          row.push(0);
        } else {
          row.push(euclideanDistance(traitTable[ids[i]], traitTable[ids[j]]));
        }
      }
      matrix.push(row);
    }
    return { ids, matrix };
  }

  function euclideanDistance(a, b) {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
      total += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(total);
  }

  function averageDistance(clusterA, clusterB, matrix, ids) {
    let total = 0;
    let count = 0;
    clusterA.nodes.forEach((a) => {
      clusterB.nodes.forEach((b) => {
        const i = ids.indexOf(a);
        const j = ids.indexOf(b);
        total += matrix[i][j];
        count += 1;
      });
    });
    return count ? total / count : 0;
  }

  function performUPGMA(traitTable) {
    const { ids, matrix } = calculateDistanceMatrix(traitTable);
    if (!ids.length) return null;
    let clusters = ids.map((id) => ({ nodes: [id], distance: 0, left: null, right: null }));
    while (clusters.length > 1) {
      let min = Infinity;
      let pair = [0, 1];
      for (let i = 0; i < clusters.length; i += 1) {
        for (let j = i + 1; j < clusters.length; j += 1) {
          const dist = averageDistance(clusters[i], clusters[j], matrix, ids);
          if (dist < min) {
            min = dist;
            pair = [i, j];
          }
        }
      }
      const [i, j] = pair;
      const merged = {
        nodes: [...clusters[i].nodes, ...clusters[j].nodes],
        distance: min / 2,
        left: clusters[i],
        right: clusters[j]
      };
      clusters = clusters.filter((_, idx) => idx !== i && idx !== j);
      clusters.push(merged);
    }
    return clusters[0];
  }

  function upgmaToNewick(cluster) {
    if (!cluster) return null;
    if (cluster.nodes.length === 1) {
      return `${cluster.nodes[0]}:${cluster.distance.toFixed(4)}`;
    }
    return `(${upgmaToNewick(cluster.left)},${upgmaToNewick(cluster.right)}):${cluster.distance.toFixed(4)}`;
  }

  function buildTraitNewick(records) {
    const table = {};
    records.forEach((record) => {
      table[record.id] = record.observedTrait.slice();
    });
    if (Object.keys(table).length < 2) return null;
    const cluster = performUPGMA(table);
    if (!cluster) return null;
    return `${upgmaToNewick(cluster)};`;
  }

  function parseNewick(str) {
    if (!str || str === ';') return null;
    const ancestors = [];
    let tree = {};
    const tokens = str.split(/\s*(;|\(|\)|,|:)\s*/);
    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      switch (token) {
        case '(':
          const subtreeA = {};
          tree.branchset = [subtreeA];
          ancestors.push(tree);
          tree = subtreeA;
          break;
        case ',':
          const subtreeB = {};
          ancestors[ancestors.length - 1].branchset.push(subtreeB);
          tree = subtreeB;
          break;
        case ')':
          tree = ancestors.pop();
          break;
        case ':':
          break;
        default:
          if (!token) break;
          const prev = tokens[i - 1];
          if (prev === ')' || prev === '(' || prev === ',') tree.name = token;
          else if (prev === ':') tree.length = parseFloat(token);
      }
    }
    return tree;
  }

  function serializeNewick(node) {
    if (!node) return '';
    let out = '';
    if (node.branchset && node.branchset.length) {
      out += `(${node.branchset.map((child) => serializeNewick(child)).join(',')})`;
    }
    if (node.name) out += node.name;
    if (typeof node.length === 'number' && Number.isFinite(node.length)) out += `:${node.length}`;
    return out;
  }

  function pruneTree(node, labelsToRemove) {
    if (!node) return null;
    if (!node.branchset || !node.branchset.length) {
      return labelsToRemove.has(node.name) ? null : node;
    }
    const kept = node.branchset.map((child) => pruneTree(child, labelsToRemove)).filter(Boolean);
    if (!kept.length) return null;
    node.branchset = kept;
    return node;
  }

  function lTableToNewick(lTable, age, pruneExtinct) {
    if (!lTable || !lTable.length) return null;
    const L2 = JSON.parse(JSON.stringify(lTable)).sort((a, b) => Math.abs(a.childId) - Math.abs(b.childId));
    L2[0].eventTime = -1;
    L2.forEach((row) => {
      row.tend = row.extinctTime === -1 ? age : row.extinctTime;
      delete row.extinctTime;
    });

    const linlist = L2.map((row) => ({
      eventTime: row.eventTime,
      parentId: row.parentId,
      childId: row.childId,
      label: Math.abs(row.childId).toString(),
      tend: row.tend
    }));

    let done = false;
    while (!done) {
      const j = linlist.reduce((maxIdx, row, idx, arr) => (row.eventTime > arr[maxIdx].eventTime ? idx : maxIdx), 0);
      const parent = linlist[j].parentId;
      const parentj = linlist.findIndex((row) => row.childId === parent);

      if (parentj !== -1) {
        const spec1 = `${linlist[parentj].label}:${Math.max(0, linlist[parentj].tend - linlist[j].eventTime).toFixed(4)}`;
        const spec2 = `${linlist[j].label}:${Math.max(0, linlist[j].tend - linlist[j].eventTime).toFixed(4)}`;
        linlist[parentj].label = `(${spec1},${spec2})`;
        linlist[parentj].tend = linlist[j].eventTime;
        linlist.splice(j, 1);
      } else {
        const parentRow = L2.find((row) => row.childId === parent);
        if (parentRow) {
          linlist[j].eventTime = parentRow.eventTime;
          linlist[j].parentId = parentRow.parentId;
          linlist[j].childId = parentRow.childId;
        } else {
          done = true;
        }
      }

      if (linlist.length === 1) done = true;
    }

    let newickString = `${linlist[0].label}:${Math.max(0, linlist[0].tend).toFixed(4)};`;
    if (pruneExtinct) {
      const tree = parseNewick(newickString);
      if (!tree) return newickString;
      const extinct = new Set(lTable.filter((row) => row.extinctTime !== -1).map((row) => Math.abs(row.childId).toString()));
      const pruned = pruneTree(tree, extinct);
      if (pruned) newickString = `${serializeNewick(pruned)};`;
    }
    return newickString;
  }

  function collectLeaves(tree) {
    const leaves = [];
    function walk(node, parent = null, depth = 0) {
      node._parent = parent;
      node._depth = depth;
      if (!node.branchset || !node.branchset.length) {
        leaves.push(node);
      } else {
        node.branchset.forEach((child) => walk(child, node, depth + 1));
      }
    }
    if (tree) walk(tree);
    return leaves;
  }

  function edgeDistance(a, b) {
    let x = a;
    let y = b;
    let dist = 0;
    while (x._depth > y._depth) {
      x = x._parent;
      dist += 1;
    }
    while (y._depth > x._depth) {
      y = y._parent;
      dist += 1;
    }
    while (x !== y) {
      x = x._parent;
      y = y._parent;
      dist += 2;
    }
    return dist;
  }

  function treeDistanceVector(newick) {
    const tree = parseNewick(newick);
    if (!tree) return null;
    const leaves = collectLeaves(tree);
    if (leaves.length < 2) return null;
    const labels = leaves.map((leaf) => leaf.name);
    const vector = new Map();
    for (let i = 0; i < leaves.length; i += 1) {
      for (let j = i + 1; j < leaves.length; j += 1) {
        const key = `${labels[i]}|${labels[j]}`;
        vector.set(key, edgeDistance(leaves[i], leaves[j]));
      }
    }
    return { labels, vector };
  }

  function pearson(xs, ys) {
    if (xs.length !== ys.length || xs.length < 2) return null;
    const mx = d3.mean(xs);
    const my = d3.mean(ys);
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < xs.length; i += 1) {
      const ax = xs[i] - mx;
      const ay = ys[i] - my;
      num += ax * ay;
      dx += ax * ax;
      dy += ay * ay;
    }
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
  }

  function computeAgreement(historyNewick, traitNewick) {
    const a = treeDistanceVector(historyNewick);
    const b = treeDistanceVector(traitNewick);
    if (!a || !b) return null;
    const xs = [];
    const ys = [];
    a.vector.forEach((value, key) => {
      if (b.vector.has(key)) {
        xs.push(value);
        ys.push(b.vector.get(key));
      }
    });
    return pearson(xs, ys);
  }

  function projectTraits(records) {
    if (!records.length) return [];
    const dims = state.settings.traitDimensions;
    const data = records.map((record) => record.observedTrait.slice());

    if (dims === 1) {
      return records.map((record) => ({ record, x: record.observedTrait[0], y: 0 }));
    }
    if (dims === 2 || !window.numeric || records.length < 3) {
      return records.map((record) => ({ record, x: record.observedTrait[0], y: record.observedTrait[1] || 0 }));
    }

    try {
      const means = Array(dims).fill(0);
      data.forEach((row) => row.forEach((v, i) => { means[i] += v; }));
      for (let i = 0; i < dims; i += 1) means[i] /= data.length;
      const centered = data.map((row) => row.map((v, i) => v - means[i]));
      const svd = numeric.svd(centered);
      const V = svd.V;
      const basis = V.map((row) => row.slice(0, 2));
      const projected = numeric.dot(centered, basis);
      return records.map((record, idx) => ({ record, x: projected[idx][0], y: projected[idx][1] }));
    } catch (error) {
      return records.map((record) => ({ record, x: record.observedTrait[0], y: record.observedTrait[1] || 0 }));
    }
  }

  function recomputeDerived() {
    state.settings = cacheSettings();
    rebuildNodeMap();
    const coarsened = buildCoarsenedData();
    const observedRecords = getObservedRecords(coarsened, state.settings.pruneExtinct);
    const historyNewick = lTableToNewick(coarsened.lTable, Math.max(state.time, 0), state.settings.pruneExtinct);
    const traitNewick = buildTraitNewick(observedRecords);
    const agreement = computeAgreement(historyNewick, traitNewick);
    const traitProjection = projectTraits(observedRecords);

    state.derived = {
      coarsened,
      observedRecords,
      historyNewick,
      traitNewick,
      agreement,
      traitProjection
    };
  }

  function colorForItem(item) {
    if (!item.active) return palette.grey;
    return item.mutated ? palette.red : palette.blue;
  }

  function setHighlight(recordId) {
    state.highlightRecordId = recordId ? String(recordId) : null;
    updateHighlights();
  }

  function updateHighlights() {
    const id = state.highlightRecordId;
    const dimOpacity = 0.20;

    d3.selectAll('.evonet-segment')
      .attr('opacity', function () {
        return !id || this.dataset.recordId === id ? 0.95 : dimOpacity;
      })
      .attr('stroke-width', function () {
        return id && this.dataset.recordId === id ? 4.5 : 2.5;
      });

    d3.selectAll('.evonet-connector')
      .attr('opacity', function () {
        return !id || this.dataset.recordId === id ? 0.9 : dimOpacity;
      })
      .attr('stroke-width', function () {
        return id && this.dataset.recordId === id ? 2.8 : 1.5;
      });

    d3.selectAll('.evonet-birth-dot')
      .attr('opacity', function () {
        return !id || this.dataset.recordId === id ? 1 : dimOpacity;
      })
      .attr('r', function () {
        return id && this.dataset.recordId === id ? 6 : (+this.dataset.baseR || 4.2);
      })
      .attr('stroke', function () {
        return id && this.dataset.recordId === id ? palette.yellow : palette.nodeRing;
      })
      .attr('stroke-width', function () {
        return id && this.dataset.recordId === id ? 2 : 1.2;
      });

    d3.selectAll('.evonet-inline-label')
      .style('opacity', function () {
        return !id || this.dataset.recordId === id ? 0.9 : 0.25;
      })
      .style('font-weight', function () {
        return id && this.dataset.recordId === id ? 700 : 500;
      });

    d3.selectAll('.evonet-tree-leaf-label')
      .style('opacity', function () {
        return !id || this.dataset.recordId === id ? 1 : 0.22;
      })
      .style('font-weight', function () {
        return id && this.dataset.recordId === id ? 700 : 500;
      });

    d3.selectAll('.evonet-tree-leaf-node')
      .attr('opacity', function () {
        return !id || this.dataset.recordId === id ? 1 : 0.18;
      })
      .attr('r', function () {
        return id && this.dataset.recordId === id ? 5.5 : 4.2;
      })
      .attr('stroke', function () {
        return id && this.dataset.recordId === id ? palette.yellow : palette.nodeRing;
      })
      .attr('stroke-width', function () {
        return id && this.dataset.recordId === id ? 1.8 : 0.8;
      });

    d3.selectAll('.evonet-tree-leaf-link')
      .attr('opacity', function () {
        return !id || this.dataset.recordId === id ? 0.88 : 0.18;
      })
      .attr('stroke-width', function () {
        return id && this.dataset.recordId === id ? 2.8 : 1.3;
      });

    d3.selectAll('.evonet-tree-internal-link')
      .attr('opacity', function () {
        return !id ? 0.88 : 0.28;
      });

    d3.selectAll('.evonet-tree-internal-node')
      .attr('opacity', function () {
        return !id ? 1 : 0.25;
      });

    d3.selectAll('.evonet-trait-point')
      .attr('opacity', function () {
        return !id || this.dataset.recordId === id ? 0.95 : 0.22;
      })
      .attr('r', function () {
        return id && this.dataset.recordId === id ? 6.2 : 4.8;
      })
      .attr('stroke', function () {
        return id && this.dataset.recordId === id ? palette.yellow : palette.nodeRing;
      })
      .attr('stroke-width', function () {
        return id && this.dataset.recordId === id ? 2 : 1.1;
      });

    d3.selectAll('.evonet-trait-label')
      .style('opacity', function () {
        return !id || this.dataset.recordId === id ? 0.9 : 0.25;
      })
      .style('font-weight', function () {
        return id && this.dataset.recordId === id ? 700 : 500;
      });
  }

  function makeTooltip(container) {
    let tip = container.querySelector('.evonet-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'evonet-tooltip';
      container.appendChild(tip);
    }
    return tip;
  }

  function showTooltip(container, event, html) {
    const tip = makeTooltip(container);
    tip.innerHTML = html;
    tip.style.opacity = '1';
    const rect = container.getBoundingClientRect();
    tip.style.left = `${event.clientX - rect.left + 12}px`;
    tip.style.top = `${event.clientY - rect.top + 12}px`;
  }

  function hideTooltip(container) {
    const tip = makeTooltip(container);
    tip.style.opacity = '0';
  }


  function setEventDrawerOpen(open) {
    const nextOpen = Boolean(open);
    state.eventDrawerOpen = nextOpen;

    if (state.drawerTimer) {
      clearTimeout(state.drawerTimer);
      state.drawerTimer = null;
    }

    if (dom.eventDrawer) {
      dom.eventDrawer.classList.toggle('is-open', nextOpen);
      dom.eventDrawer.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    }

    if (dom.eventDrawerButton) {
      dom.eventDrawerButton.classList.toggle('is-active', nextOpen);
      dom.eventDrawerButton.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    }

    if (dom.eventDrawerBackdrop) {
      if (nextOpen) {
        dom.eventDrawerBackdrop.hidden = false;
        requestAnimationFrame(() => {
          if (state.eventDrawerOpen && dom.eventDrawerBackdrop) dom.eventDrawerBackdrop.classList.add('is-open');
        });
      } else {
        dom.eventDrawerBackdrop.classList.remove('is-open');
        state.drawerTimer = setTimeout(() => {
          if (!state.eventDrawerOpen && dom.eventDrawerBackdrop) dom.eventDrawerBackdrop.hidden = true;
        }, 220);
      }
    }
  }

  function toggleEventDrawer(force) {
    if (typeof force === 'boolean') {
      setEventDrawerOpen(force);
      return;
    }
    setEventDrawerOpen(!state.eventDrawerOpen);
  }

  function emptyPanel(container, title, subtitle) {
    container.innerHTML = '';
    const wrapper = d3.select(container)
      .append('div')
      .attr('class', 'evonet-empty-state');
    wrapper.append('div').attr('class', 'evonet-empty-title').text(title);
    if (subtitle) wrapper.append('div').attr('class', 'evonet-empty-subtitle').text(subtitle);
  }

  function renderChronogram(container, items, label) {
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
      emptyPanel(container, `No ${label.toLowerCase()} yet.`, '');
      return;
    }

    const { width, height } = safeContainerSize(container, 330);
    const margin = { top: 18, right: 18, bottom: 32, left: 28 };
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'evonet-svg');

    const maxTime = Math.max(state.time, 1);
    const x = d3.scaleLinear().domain([0, maxTime * 1.02]).range([margin.left, width - margin.right]);
    const order = preorderIds(items);
    const y = d3.scalePoint().domain(order.map(String)).range([margin.top, height - margin.bottom]).padding(0.6);
    const itemMap = new Map(items.map((d) => [d.id, d]));

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, Math.max(2, Math.floor(width / 100))))
        .tickSizeOuter(0))
      .call((g) => g.selectAll('text').attr('class', 'evonet-axis-label'))
      .call((g) => g.selectAll('line').attr('stroke', palette.axisGrid))
      .call((g) => g.select('.domain').attr('stroke', palette.axis));

    svg.append('line')
      .attr('x1', x(state.time))
      .attr('x2', x(state.time))
      .attr('y1', margin.top / 2)
      .attr('y2', height - margin.bottom)
      .attr('stroke', palette.axisGuide)
      .attr('stroke-dasharray', '4,4');

    svg.append('text')
      .attr('x', width - margin.right)
      .attr('y', 14)
      .attr('text-anchor', 'end')
      .attr('class', 'evonet-axis-caption')
      .text('time');

    const linkLayer = svg.append('g');
    items.forEach((item) => {
      if (!item.parentId || !itemMap.has(item.parentId)) return;
      const recordId = String(item.recordId ?? item.id);
      linkLayer.append('line')
        .attr('x1', x(item.birthTime))
        .attr('x2', x(item.birthTime))
        .attr('y1', y(String(item.parentId)))
        .attr('y2', y(String(item.id)))
        .attr('stroke', palette.connector)
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.9)
        .attr('class', 'evonet-connector')
        .attr('data-record-id', recordId);
    });

    const lineLayer = svg.append('g');
    items.forEach((item) => {
      const endTime = Math.max(item.endTime ?? getNodeEndTime(item), item.birthTime + 1e-6);
      const recordId = String(item.recordId ?? item.id);
      const baseR = items.length <= 12 ? 4.6 : 4.2;
      const group = lineLayer.append('g')
        .attr('class', 'evonet-interactive')
        .on('mouseenter', (event) => {
          setHighlight(recordId);
          const extra = item.recordId && item.recordId !== item.id ? `<br>Mapped species: ${item.recordId}` : '';
          showTooltip(container, event, `
            <strong>${label} ${item.id}</strong><br>
            Born: ${formatNum(item.birthTime)}<br>
            End: ${formatNum(endTime)}<br>
            State: ${item.active ? 'extant' : 'extinct'}${extra}
          `);
        })
        .on('mousemove', (event) => {
          const extra = item.recordId && item.recordId !== item.id ? `<br>Mapped species: ${item.recordId}` : '';
          showTooltip(container, event, `
            <strong>${label} ${item.id}</strong><br>
            Born: ${formatNum(item.birthTime)}<br>
            End: ${formatNum(endTime)}<br>
            State: ${item.active ? 'extant' : 'extinct'}${extra}
          `);
        })
        .on('mouseleave', () => {
          hideTooltip(container);
          setHighlight(null);
        });

      group.append('line')
        .attr('x1', x(item.birthTime))
        .attr('x2', x(endTime))
        .attr('y1', y(String(item.id)))
        .attr('y2', y(String(item.id)))
        .attr('stroke', colorForItem(item))
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.95)
        .attr('stroke-dasharray', item.active ? null : '5,4')
        .attr('class', 'evonet-segment')
        .attr('data-record-id', recordId);

      group.append('circle')
        .attr('cx', x(item.birthTime))
        .attr('cy', y(String(item.id)))
        .attr('r', baseR)
        .attr('fill', colorForItem(item))
        .attr('stroke', palette.nodeRing)
        .attr('stroke-width', 1.2)
        .attr('opacity', 1)
        .attr('class', 'evonet-birth-dot')
        .attr('data-record-id', recordId)
        .attr('data-base-r', baseR);

      if (!item.active) {
        group.append('line')
          .attr('x1', x(endTime) - 3)
          .attr('x2', x(endTime) + 3)
          .attr('y1', y(String(item.id)) - 3)
          .attr('y2', y(String(item.id)) + 3)
          .attr('stroke', palette.grey)
          .attr('stroke-width', 1.2);
        group.append('line')
          .attr('x1', x(endTime) - 3)
          .attr('x2', x(endTime) + 3)
          .attr('y1', y(String(item.id)) + 3)
          .attr('y2', y(String(item.id)) - 3)
          .attr('stroke', palette.grey)
          .attr('stroke-width', 1.2);
      }

      if (items.length <= 16) {
        group.append('text')
          .attr('x', margin.left - 6)
          .attr('y', y(String(item.id)) + 4)
          .attr('text-anchor', 'end')
          .attr('class', 'evonet-small-label evonet-inline-label')
          .attr('data-record-id', recordId)
          .text(item.id);
      }
    });
  }

  function radialLinkStep(startAngle, startRadius, endAngle, endRadius) {
    const c0 = Math.cos((startAngle - 90) / 180 * Math.PI);
    const s0 = Math.sin((startAngle - 90) / 180 * Math.PI);
    const c1 = Math.cos((endAngle - 90) / 180 * Math.PI);
    const s1 = Math.sin((endAngle - 90) / 180 * Math.PI);
    return `M${startRadius * c0},${startRadius * s0}` +
      (endAngle === startAngle ? '' : `A${startRadius},${startRadius} 0 0 ${endAngle > startAngle ? 1 : 0} ${startRadius * c1},${startRadius * s1}`) +
      `L${endRadius * c1},${endRadius * s1}`;
  }

  function enrichTreeLayout(rootNode) {
    rootNode.eachAfter((node) => {
      if (!node.children || !node.children.length) {
        node.leafKey = String(node.data.name || '');
      } else {
        node.leafKey = node.children.map((child) => child.leafKey).sort().join('|');
      }
    });

    rootNode.each((node) => {
      node.layoutKey = node.leafKey || String(node.data.name || '');
      node.displayRadius = state.settings.showBranchLengths ? node.radius : node.y;
    });
  }

  function buildRadialLayout(newick, width, height) {
    const data = parseNewick(newick);
    if (!data) return null;

    const rootNode = d3.hierarchy(data, (d) => d.branchset)
      .sum((d) => (d.branchset ? 0 : 1))
      .sort((a, b) => (a.value - b.value) || d3.ascending(a.data.length || 0, b.data.length || 0));

    const outerRadius = Math.min(width, height) / 2 - 8;
    const innerRadius = Math.max(outerRadius - 58, 44);
    const cluster = d3.cluster().size([360, innerRadius]).separation(() => 1);
    cluster(rootNode);

    function maxLength(node) {
      return (node.data.length || 0) + (node.children ? d3.max(node.children, maxLength) : 0);
    }

    function setRadius(node, y0, k) {
      node.radius = (y0 += node.data.length || 0) * k;
      if (node.children) node.children.forEach((child) => setRadius(child, y0, k));
    }

    const radialScale = innerRadius / Math.max(maxLength(rootNode), 1e-6);
    setRadius(rootNode, 0, radialScale);
    enrichTreeLayout(rootNode);

    return { rootNode, innerRadius };
  }

  function drawRadialTree(container, newick, recordMap, emptyTitle, options = {}) {
    if (!container) return;
    if (!newick || newick === ';') {
      container.innerHTML = '';
      emptyPanel(container, emptyTitle, 'You need at least two observed taxa before a tree makes sense.');
      return;
    }

    const { width, height } = safeContainerSize(container, 330);
    const layout = buildRadialLayout(newick, width, height);
    if (!layout || layout.rootNode.leaves().length < 2) {
      container.innerHTML = '';
      emptyPanel(container, emptyTitle, 'You need at least two observed taxa before a tree makes sense.');
      return;
    }

    let svg = d3.select(container).select('svg.evonet-svg');
    if (svg.empty()) {
      container.innerHTML = '';
      svg = d3.select(container)
        .append('svg')
        .attr('class', 'evonet-svg');
    }

    svg.attr('width', width)
      .attr('height', height)
      .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);

    const transition = options.animate
      ? svg.transition().duration(520).ease(d3.easeCubicInOut)
      : null;

    const rootG = svg.selectAll('g.evonet-tree-root')
      .data([null])
      .join('g')
      .attr('class', 'evonet-tree-root');

    function guidePath(d) {
      return radialLinkStep(d.target.x, d.target.displayRadius, d.target.x, layout.innerRadius);
    }

    function linkPath(d) {
      return radialLinkStep(d.source.x, d.source.displayRadius, d.target.x, d.target.displayRadius);
    }

    function nodeTransform(d) {
      return `rotate(${d.x - 90}) translate(${d.displayRadius},0)`;
    }

    function labelTransform(d) {
      return `rotate(${d.x - 90}) translate(${layout.innerRadius + 10},0)${d.x < 180 ? '' : ' rotate(180)'}`;
    }

    const guideData = layout.rootNode.links().filter((d) => !d.target.children);
    const internalLinkData = layout.rootNode.links().filter((d) => d.target.children);
    const leafLinkData = layout.rootNode.links().filter((d) => !d.target.children);
    const internalNodeData = layout.rootNode.descendants().filter((d) => d.children);
    const leafNodeData = layout.rootNode.leaves();

    const guideSelection = rootG.selectAll('path.evonet-tree-guide-link')
      .data(guideData, (d) => d.target.layoutKey)
      .join(
        (enter) => enter.append('path')
          .attr('class', 'evonet-tree-guide-link')
          .attr('fill', 'none')
          .attr('stroke', palette.treeGuide)
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-width', 1)
          .attr('opacity', 0.7)
          .attr('d', (d) => guidePath(d)),
        (update) => update,
        (exit) => {
          if (transition) return exit.transition(transition).attr('opacity', 0).remove();
          exit.remove();
          return exit;
        }
      );
    maybeTransition(guideSelection, transition).attr('d', (d) => guidePath(d));

    const internalLinks = rootG.selectAll('path.evonet-tree-internal-link')
      .data(internalLinkData, (d) => d.target.layoutKey)
      .join(
        (enter) => enter.append('path')
          .attr('class', 'evonet-tree-internal-link')
          .attr('fill', 'none')
          .attr('stroke', palette.treeLink)
          .attr('stroke-width', 1.3)
          .attr('opacity', 0.88)
          .attr('d', (d) => linkPath(d)),
        (update) => update,
        (exit) => {
          if (transition) return exit.transition(transition).attr('opacity', 0).remove();
          exit.remove();
          return exit;
        }
      );
    maybeTransition(internalLinks, transition).attr('d', (d) => linkPath(d));

    const leafLinks = rootG.selectAll('path.evonet-tree-leaf-link')
      .data(leafLinkData, (d) => d.target.layoutKey)
      .join(
        (enter) => enter.append('path')
          .attr('class', 'evonet-tree-leaf-link')
          .attr('fill', 'none')
          .attr('stroke', palette.treeLink)
          .attr('stroke-width', 1.3)
          .attr('opacity', 0.88)
          .attr('d', (d) => linkPath(d)),
        (update) => update,
        (exit) => {
          if (transition) return exit.transition(transition).attr('opacity', 0).remove();
          exit.remove();
          return exit;
        }
      );
    leafLinks.attr('data-record-id', (d) => d.target.data.name);
    maybeTransition(leafLinks, transition).attr('d', (d) => linkPath(d));

    const internalNodes = rootG.selectAll('circle.evonet-tree-internal-node')
      .data(internalNodeData, (d) => d.layoutKey)
      .join(
        (enter) => enter.append('circle')
          .attr('class', 'evonet-tree-internal-node')
          .attr('r', (d) => (d === layout.rootNode ? 5.5 : 2.8))
          .attr('fill', (d) => (d === layout.rootNode ? palette.yellow : palette.treeNode))
          .attr('stroke', palette.nodeRing)
          .attr('stroke-width', 0.8)
          .attr('transform', (d) => nodeTransform(d)),
        (update) => update,
        (exit) => {
          if (transition) return exit.transition(transition).attr('opacity', 0).remove();
          exit.remove();
          return exit;
        }
      );
    maybeTransition(internalNodes, transition).attr('transform', (d) => nodeTransform(d));

    const leafNodes = rootG.selectAll('circle.evonet-tree-leaf-node')
      .data(leafNodeData, (d) => d.layoutKey)
      .join(
        (enter) => enter.append('circle')
          .attr('class', 'evonet-tree-leaf-node evonet-interactive')
          .attr('r', 4.2)
          .attr('stroke', palette.nodeRing)
          .attr('stroke-width', 0.8)
          .attr('transform', (d) => nodeTransform(d)),
        (update) => update,
        (exit) => {
          if (transition) return exit.transition(transition).attr('opacity', 0).remove();
          exit.remove();
          return exit;
        }
      );
    leafNodes
      .attr('data-record-id', (d) => d.data.name)
      .attr('fill', (d) => {
        const rec = recordMap.get(Number(d.data.name));
        return rec ? rec.displayColor : palette.accent;
      })
      .on('mouseenter', (event, d) => {
        setHighlight(d.data.name);
        const rec = recordMap.get(Number(d.data.name));
        showTooltip(container, event, `
          <strong>Taxon ${d.data.name}</strong><br>
          ${rec?.active ? 'Extant' : 'Extinct'}<br>
          Birth: ${formatNum(rec?.birthTime)}
        `);
      })
      .on('mousemove', (event, d) => {
        const rec = recordMap.get(Number(d.data.name));
        showTooltip(container, event, `
          <strong>Taxon ${d.data.name}</strong><br>
          ${rec?.active ? 'Extant' : 'Extinct'}<br>
          Birth: ${formatNum(rec?.birthTime)}
        `);
      })
      .on('mouseleave', () => {
        hideTooltip(container);
        setHighlight(null);
      });
    maybeTransition(leafNodes, transition).attr('transform', (d) => nodeTransform(d));

    const leafLabels = rootG.selectAll('text.evonet-tree-leaf-label')
      .data(leafNodeData, (d) => d.layoutKey)
      .join(
        (enter) => enter.append('text')
          .attr('class', 'evonet-tree-label evonet-tree-leaf-label')
          .attr('dy', '.31em')
          .attr('transform', (d) => labelTransform(d))
          .attr('text-anchor', (d) => (d.x < 180 ? 'start' : 'end'))
          .text((d) => d.data.name),
        (update) => update,
        (exit) => {
          if (transition) return exit.transition(transition).attr('opacity', 0).remove();
          exit.remove();
          return exit;
        }
      );
    leafLabels
      .attr('data-record-id', (d) => d.data.name)
      .attr('text-anchor', (d) => (d.x < 180 ? 'start' : 'end'))
      .text((d) => d.data.name)
      .on('mouseenter', (event, d) => {
        setHighlight(d.data.name);
        const rec = recordMap.get(Number(d.data.name));
        showTooltip(container, event, `
          <strong>Taxon ${d.data.name}</strong><br>
          ${rec?.active ? 'Extant' : 'Extinct'}<br>
          Birth: ${formatNum(rec?.birthTime)}
        `);
      })
      .on('mousemove', (event, d) => {
        const rec = recordMap.get(Number(d.data.name));
        showTooltip(container, event, `
          <strong>Taxon ${d.data.name}</strong><br>
          ${rec?.active ? 'Extant' : 'Extinct'}<br>
          Birth: ${formatNum(rec?.birthTime)}
        `);
      })
      .on('mouseleave', () => {
        hideTooltip(container);
        setHighlight(null);
      });
    maybeTransition(leafLabels, transition).attr('transform', (d) => labelTransform(d));
  }

  function renderLTT(container) {
    if (!container) return;
    container.innerHTML = '';
    const data = state.timeSeries;
    if (!data.length) {
      emptyPanel(container, 'No time-series data yet.', '');
      return;
    }

    const { width, height } = safeContainerSize(container, 300);
    const margin = { top: 16, right: 18, bottom: 34, left: 42 };
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'evonet-svg');

    const x = d3.scaleLinear()
      .domain([0, Math.max(d3.max(data, (d) => d.time), 1)])
      .range([margin.left, width - margin.right]);
    const y = d3.scaleLinear()
      .domain([0, Math.max(1, d3.max(data, (d) => Math.max(d.extantLineages, d.observedSpecies, d.totalLineages)))])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3.line()
      .x((d) => x(d.time))
      .y((d) => y(d.value))
      .curve(d3.curveStepAfter);

    const series = [
      { name: 'extant lineages', color: palette.blue, values: data.map((d) => ({ time: d.time, value: d.extantLineages })) },
      { name: 'observed species', color: palette.accent, values: data.map((d) => ({ time: d.time, value: d.observedSpecies })) },
      { name: 'total lineages', color: palette.totalLineages, values: data.map((d) => ({ time: d.time, value: d.totalLineages })) }
    ];

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, Math.max(2, Math.floor(width / 100))))
        .tickSizeOuter(0))
      .call((g) => g.selectAll('text').attr('class', 'evonet-axis-label'))
      .call((g) => g.select('.domain').attr('stroke', palette.axis));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((g) => g.selectAll('text').attr('class', 'evonet-axis-label'))
      .call((g) => g.select('.domain').attr('stroke', palette.axis))
      .call((g) => g.selectAll('line').attr('stroke', palette.axisGridStrong));

    series.forEach((s) => {
      svg.append('path')
        .datum(s.values)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 2.2)
        .attr('d', line);
    });

    const legend = svg.append('g').attr('transform', `translate(${margin.left},${margin.top - 4})`);
    series.forEach((s, idx) => {
      const g = legend.append('g').attr('transform', `translate(${idx * 118},0)`);
      g.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0).attr('stroke', s.color).attr('stroke-width', 2.5);
      g.append('text').attr('x', 24).attr('y', 4).attr('class', 'evonet-small-label').text(s.name);
    });
  }

  function renderTraitSpace(container) {
    if (!container) return;
    container.innerHTML = '';
    const points = state.derived.traitProjection;
    if (!points.length) {
      emptyPanel(container, 'No observed taxa in trait space.', '');
      return;
    }

    const { width, height } = safeContainerSize(container, 300);
    const margin = { top: 18, right: 18, bottom: 36, left: 42 };
    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'evonet-svg');

    const xExtent = d3.extent(points, (d) => d.x);
    const yExtent = d3.extent(points, (d) => d.y);
    const xPad = (xExtent[1] - xExtent[0] || 1) * 0.2;
    const yPad = (yExtent[1] - yExtent[0] || 1) * 0.2;
    const x = d3.scaleLinear().domain([xExtent[0] - xPad, xExtent[1] + xPad]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([yExtent[0] - yPad, yExtent[1] + yPad]).range([height - margin.bottom, margin.top]);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5))
      .call((g) => g.selectAll('text').attr('class', 'evonet-axis-label'))
      .call((g) => g.select('.domain').attr('stroke', palette.axis));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call((g) => g.selectAll('text').attr('class', 'evonet-axis-label'))
      .call((g) => g.select('.domain').attr('stroke', palette.axis));

    svg.append('line')
      .attr('x1', x(0)).attr('x2', x(0))
      .attr('y1', margin.top).attr('y2', height - margin.bottom)
      .attr('stroke', palette.axisGrid).attr('stroke-dasharray', '3,3');
    svg.append('line')
      .attr('x1', margin.left).attr('x2', width - margin.right)
      .attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', palette.axisGrid).attr('stroke-dasharray', '3,3');

    svg.append('text').attr('x', width - margin.right).attr('y', height - 8).attr('text-anchor', 'end').attr('class', 'evonet-axis-caption')
      .text(state.settings.traitDimensions > 2 ? 'PC1' : 'Trait 1');
    svg.append('text').attr('x', margin.left).attr('y', margin.top - 4).attr('class', 'evonet-axis-caption')
      .text(state.settings.traitDimensions > 2 ? 'PC2' : 'Trait 2');

    svg.append('g').selectAll('circle').data(points).join('circle')
      .attr('cx', (d) => x(d.x))
      .attr('cy', (d) => y(d.y))
      .attr('r', 4.8)
      .attr('fill', (d) => d.record.displayColor)
      .attr('stroke', palette.nodeRing)
      .attr('stroke-width', 1.1)
      .attr('opacity', 0.95)
      .attr('class', 'evonet-trait-point evonet-interactive')
      .attr('data-record-id', (d) => d.record.id)
      .on('mouseenter', (event, d) => {
        setHighlight(d.record.id);
        showTooltip(container, event, `<strong>Taxon ${d.record.id}</strong><br>${d.record.observedTrait.map((v) => formatNum(v)).join(', ')}`);
      })
      .on('mousemove', (event, d) => {
        showTooltip(container, event, `<strong>Taxon ${d.record.id}</strong><br>${d.record.observedTrait.map((v) => formatNum(v)).join(', ')}`);
      })
      .on('mouseleave', () => {
        hideTooltip(container);
        setHighlight(null);
      });

    if (points.length <= 14) {
      svg.append('g').selectAll('text').data(points).join('text')
        .attr('x', (d) => x(d.x) + 7)
        .attr('y', (d) => y(d.y) - 7)
        .attr('class', 'evonet-small-label evonet-trait-label')
        .attr('data-record-id', (d) => d.record.id)
        .text((d) => d.record.id);
    }
  }

  function renderStatusCards() {
    if (dom.extantCount) dom.extantCount.textContent = state.activeIds.size;
    if (dom.extinctCount) dom.extinctCount.textContent = state.nodes.length - state.activeIds.size;
    if (dom.observedCount) dom.observedCount.textContent = state.derived.observedRecords.length;
    if (dom.timeCount) dom.timeCount.textContent = formatNum(state.time, 2);
    if (dom.agreementCount) dom.agreementCount.textContent = state.derived.agreement === null ? 'n/a' : formatNum(state.derived.agreement, 2);

    if (dom.statusNote) {
      const net = state.settings.birthRate + state.settings.mutateRate - state.settings.deathRate;
      const modelText = state.settings.traitModel === 'ou' ? `OU-like pull (α = ${formatNum(state.settings.ouAlpha, 2)})` : 'Brownian trait steps';
      dom.statusNote.textContent = `Step ${state.step}/${state.settings.maxSteps} • ${modelText} • net diversification pressure ≈ ${formatNum(net, 2)}`;
    }
  }

  function renderEventFeed() {
    if (!dom.eventFeed) return;
    dom.eventFeed.innerHTML = '';
    if (!state.eventLog.length) {
      dom.eventFeed.innerHTML = '<div class="evonet-feed-empty">Press Grow or Step to generate a trajectory.</div>';
      return;
    }
    state.eventLog.slice(0, 12).forEach((line) => {
      const div = document.createElement('div');
      div.className = 'evonet-feed-line';
      div.textContent = line;
      dom.eventFeed.appendChild(div);
    });
  }

  function renderAll() {
    refreshPalette();
    renderStatusCards();
    renderEventFeed();
    const recordByNode = state.derived.coarsened.recordByNode;
    const animateTreeMode = state.lastRenderedBranchLengthMode !== null
      && state.lastRenderedBranchLengthMode !== state.settings.showBranchLengths;

    renderChronogram(dom.graphContainer, state.nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      birthTime: node.birthTime,
      endTime: getNodeEndTime(node),
      active: node.active,
      mutated: node.mutated,
      recordId: recordByNode.get(node.id)
    })), 'Lineage');

    renderChronogram(dom.coarsenedContainer, state.derived.coarsened.records.map((record) => ({
      id: record.id,
      parentId: record.parentId,
      birthTime: record.birthTime,
      endTime: record.endTime,
      active: record.active,
      mutated: record.mutated,
      recordId: record.id
    })), 'Species');

    const recordMap = new Map(state.derived.coarsened.records.map((record) => [record.id, record]));
    drawRadialTree(dom.historyTreeContainer, state.derived.historyNewick, recordMap, 'No valid history tree', { animate: animateTreeMode });
    drawRadialTree(dom.traitTreeContainer, state.derived.traitNewick, recordMap, 'No valid trait tree', { animate: animateTreeMode });
    renderLTT(dom.lttContainer);
    renderTraitSpace(dom.traitSpaceContainer);
    updateHighlights();
    state.lastRenderedBranchLengthMode = state.settings.showBranchLengths;
  }

  function exportJson() {
    const payload = {
      settings: state.settings,
      time: state.time,
      step: state.step,
      nodes: state.nodes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        birthTime: n.birthTime,
        extinctTime: n.extinctTime,
        active: n.active,
        mutated: n.mutated,
        eventType: n.eventType,
        trait: n.trait
      })),
      coarsenedRecords: state.derived.coarsened.records,
      historyNewick: state.derived.historyNewick,
      traitNewick: state.derived.traitNewick,
      eventLog: state.eventLog,
      timeSeries: state.timeSeries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evonet-run-seed-${state.settings.seed}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function bindControls() {
    [
      dom.birthRate,
      dom.mutateRate,
      dom.deathRate,
      dom.maxSteps,
      dom.mstep,
      dom.traitDimensions,
      dom.traitSigma,
      dom.ouAlpha,
      dom.traitModel,
      dom.pruneExtinct,
      dom.showBranchLengths
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', () => {
        syncValueSpans();
        if (el.id === 'mstep') {
          recomputeDerived();
          renderAll();
        }
      });
      el.addEventListener('change', () => {
        syncValueSpans();
        recomputeDerived();
        renderAll();
      });
    });

    dom.startButton.addEventListener('click', startSimulation);
    dom.pauseButton.addEventListener('click', pauseSimulation);
    dom.stepButton.addEventListener('click', () => {
      if (!state.running) simulateStep();
    });
    dom.resetButton.addEventListener('click', resetSimulation);
    dom.randomSeedButton.addEventListener('click', randomizeSeed);
    dom.presetSelect.addEventListener('change', () => applyPreset(dom.presetSelect.value));
    dom.exportJsonButton.addEventListener('click', exportJson);
    dom.copyHistoryNewickButton.addEventListener('click', () => copyText(state.derived.historyNewick || ''));
    dom.copyTraitNewickButton.addEventListener('click', () => copyText(state.derived.traitNewick || ''));

    if (dom.eventDrawerButton) dom.eventDrawerButton.addEventListener('click', () => toggleEventDrawer());
    if (dom.eventDrawerCloseButton) dom.eventDrawerCloseButton.addEventListener('click', () => toggleEventDrawer(false));
    if (dom.eventDrawerBackdrop) dom.eventDrawerBackdrop.addEventListener('click', () => toggleEventDrawer(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.eventDrawerOpen) {
        toggleEventDrawer(false);
      }
    });

    window.addEventListener('resize', debounce(() => {
      recomputeDerived();
      renderAll();
    }, 120));
  }

  bindThemeSync();
  bindControls();
  syncValueSpans();
  setEventDrawerOpen(false);
  applyPreset('balanced');
  resetSimulation();
  syncThemeWithPage(true);
})();

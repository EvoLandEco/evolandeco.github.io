import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { relationshipNetwork, relationshipOverview, relationshipSources, relationshipGroupFilter, relationshipGroupLayout, relationshipLabelRotation, relationshipRing, relationshipMorphArc, relationshipWedge, relationshipSourceColors, relationshipSourceMarks, relationshipCallout } from '../src/lib/atlas-relationship-network';
import type { AtlasAssessment, AtlasRecord } from '../src/lib/atlas';

const records = new Map(['a', 'b', 'c'].map(id => [id, { id, document_id: id === 'b' ? 'a' : id } as AtlasRecord]));
const ids = new Set(records.keys());
const entry = (id: string, support: string[]): AtlasAssessment => ({ id, track: 'topic', type: 'exposure', status: 'Reported exposure', from: 'Animals', to: 'People', basis: '', limit: '', support: support.map(id => [id, 0]) });

test('shared supporting documents connect entries, without merging their endpoint labels', () => {
  const graph = relationshipNetwork([entry('one', ['a']), entry('two', ['b']), entry('three', ['c'])], records, ids);
  assert.equal(graph.groups.length, 2);
  assert.equal(graph.groupByEntry.get('one'), graph.groupByEntry.get('two'));
  assert.notEqual(graph.groupByEntry.get('one'), graph.groupByEntry.get('three'));
  assert.equal(graph.groups.flatMap(group => group.nodes).length, 5);
  assert.equal(graph.edges.length, 3);
});

test('each report has one edge per relationship, with every supported record retained', () => {
  const graph = relationshipNetwork([entry('one', ['a', 'b', 'a'])], records, ids);
  assert.equal(graph.edges.length, 1);
  assert.deepEqual([...graph.reports.get('a')!].sort(), ['a', 'b']);
});

test('later assessments join the graph only when their full support is selected', () => {
  const a = { ...entry('one', ['a']), updates: [{ text: 'Later assessment', support: [['b', 0], ['c', 0]] as [string, number][] }] };
  assert.equal(relationshipNetwork([a], records, new Set(['a', 'b'])).reports.size, 1);
  assert.equal(relationshipNetwork([a], records, ids).reports.size, 2);
});

test('empty endpoints, isolates and an empty selection keep finite geometry', () => {
  for (const entries of [[], [{ ...entry('one', []), from: '', to: '' }]]) {
    const graph = relationshipNetwork(entries, records, ids);
    const bubbles = relationshipOverview(graph, new Map(entries.map(entry => [entry.id, entry])));
    for (const bubble of bubbles) assert.ok([bubble.x, bubble.y, bubble.radius].every(Number.isFinite));
    for (const group of graph.groups) {
      const layout = relationshipGroupLayout(group, new Map(entries.map(entry => [entry.id, entry])), new Map());
      assert.ok(Number.isFinite(layout.radius));
      for (const node of layout.nodes) assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
    }
  }
});

test('layout is independent of entry order', () => {
  const entries = [entry('one', ['a', 'c']), entry('two', ['b'])];
  assert.deepEqual(relationshipNetwork(entries, records, ids).groups, relationshipNetwork(entries.toReversed(), records, ids).groups);
});

test('neighbor lookup contains exactly the two ends of every evidence edge', () => {
  const graph = relationshipNetwork([entry('one', ['a', 'c']), entry('two', ['b']), entry('isolated', [])], records, ids);
  assert.deepEqual([...graph.neighbors.get('report:a')!].sort(), ['relationship:one', 'relationship:two']);
  assert.equal(graph.neighbors.get('relationship:isolated')!.size, 0);
  assert.equal([...graph.neighbors.values()].reduce((sum, adjacent) => sum + adjacent.size, 0), 2 * graph.edges.length);
  for (const edge of graph.edges) {
    assert.ok(graph.neighbors.get(edge.from)!.has(edge.to));
    assert.ok(graph.neighbors.get(edge.to)!.has(edge.from));
  }
});

test('overview glyphs retain group membership and type proportions without detailed geometry', () => {
  const entries = [entry('one', ['a', 'c']), { ...entry('two', ['b']), type: 'transmission' }, entry('isolated', [])];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const graph = relationshipNetwork(entries, records, ids);
  const overview = relationshipOverview(graph, byId);
  assert.equal(overview.length, graph.groups.length);
  assert.equal(overview.reduce((sum, group) => sum + group.count, 0), entries.length);
  for (const group of overview) {
    assert.equal(group.parts.reduce((sum, part) => sum + part.fraction, 0), 1);
    assert.equal(graph.groupByEntry.get(group.first), group.id);
    assert.ok(!('nodes' in group) && !('edges' in group));
  }
});

test('empty overview has no group targets', () => {
  assert.deepEqual(relationshipOverview(relationshipNetwork([], records, ids), new Map()), []);
});

test('group filters union each category, intersect categories and retain complete groups', () => {
  const records = new Map(['a', 'b', 'c', 'd'].map((id, i) => [id, { id, document_id: id, source: i % 2 ? 'north' : 'south' } as AtlasRecord]));
  const entries = [
    { ...entry('mixed-exposure', ['a']), type: 'exposure' },
    { ...entry('mixed-transmission', ['a']), type: 'transmission' },
    { ...entry('north-exposure', ['b']), type: 'exposure' },
    { ...entry('joint-identity', ['c', 'd']), type: 'identity' },
    entry('isolate', []),
  ];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const graph = relationshipNetwork(entries, records, new Set(records.keys()));
  const sources = relationshipSources(graph, records);
  const filter = (types: string[] = [], publishers: string[] = []) => relationshipGroupFilter(graph, byId, sources, types, publishers);
  assert.deepEqual(filter().groups, graph.groups);
  assert.equal(filter().entryCount, 5);
  assert.equal(filter().reportCount, 4);
  const selected = filter(['transmission'], ['south']);
  assert.equal(selected.groups.length, 1);
  assert.strictEqual(selected.groups[0], graph.groups.find(group => group.id === graph.groupByEntry.get('mixed-exposure')));
  assert.deepEqual(selected.counts, [{ type: 'exposure', count: 1 }, { type: 'transmission', count: 1 }]);
  assert.equal(selected.entryCount, 2);
  assert.equal(selected.reportCount, 1);
  assert.equal(filter(['transmission', 'identity'], ['north', 'south']).groups.length, 2);
  assert.equal(filter(['transmission'], ['north']).groups.length, 0);
  assert.equal(filter([], ['north', 'south']).groups.length, 3);
  assert.equal(filter([], ['north']).reportCount, 3);
  assert.deepEqual([...selected.typeCounts].sort(), [['exposure', 1], ['identity', 1], ['transmission', 1]]);
  assert.deepEqual([...selected.sourceCounts].sort(), [['north', 0], ['south', 1]]);
  assert.equal(filter(['identity'], ['north']).groups[0].nodes.length, 3);
  assert.deepEqual(relationshipGroupFilter(relationshipNetwork([], records, new Set()), new Map(), new Map(), [], []).groups, []);
});

test('group source labels retain every supporting publisher once', () => {
  const sourceRecords = new Map(Array.from({ length: 8 }, (_, index) => {
    const id = `record-${index}`;
    return [id, { id, document_id: `document-${index}`, source: `publisher-${Math.floor(index / 2)}` } as AtlasRecord];
  }));
  const selected = new Set(sourceRecords.keys());
  const entries = [entry('many', [...selected]), entry('isolated', [])];
  const graph = relationshipNetwork(entries, sourceRecords, selected);
  const sources = relationshipSources(graph, sourceRecords);
  assert.deepEqual(sources.get(graph.groupByEntry.get('many')!), ['publisher-0', 'publisher-1', 'publisher-2', 'publisher-3']);
  assert.deepEqual(sources.get(graph.groupByEntry.get('isolated')!), []);
  const filtered = new Set(['record-0', 'record-1']);
  const filteredGraph = relationshipNetwork([entry('one', [...selected])], sourceRecords, filtered);
  assert.deepEqual([...relationshipSources(filteredGraph, sourceRecords).values()].flat(), ['publisher-0']);
});

test('overview retains small type proportions and centres a single group', () => {
  const entries = [...Array.from({ length: 99 }, (_, i) => entry(`exposure-${i}`, ['a'])), { ...entry('transmission', ['a']), type: 'transmission' }];
  const [group] = relationshipOverview(relationshipNetwork(entries, records, ids), new Map(entries.map(entry => [entry.id, entry])));
  assert.deepEqual(group.parts, [{ type: 'transmission', fraction: .01 }, { type: 'exposure', fraction: .99 }]);
  assert.ok(Math.abs(group.x) < 1e-8 && Math.abs(group.y) < 1e-8);
  assert.ok(group.radius > 0 && group.radius < 500);
});

test('overview bubbles preserve counts, area ratios and spacing across viewport shapes', () => {
  const entries = Array.from({ length: 260 }, (_, i) => entry(`isolated-${i}`, []));
  entries.push(...Array.from({ length: 38 }, (_, i) => entry(`connected-${i}`, ['a'])));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const graph = relationshipNetwork(entries, records, ids);
  for (const height of [600, 1000, 1600]) {
    const bubbles = relationshipOverview(graph, byId, 1000, height);
    assert.equal(bubbles.length, graph.groups.length);
    assert.deepEqual(new Set(bubbles.map(bubble => bubble.id)), new Set(graph.groups.map(group => group.id)));
    assert.deepEqual(bubbles, relationshipOverview(relationshipNetwork(entries.toReversed(), records, ids), byId, 1000, height));
    for (const bubble of bubbles) {
      assert.ok(bubble.radius > 0);
      assert.ok(Math.abs(bubble.x) + bubble.radius <= 500);
      assert.ok(Math.abs(bubble.y) + bubble.radius <= height / 2);
      assert.ok(Math.abs(bubble.radius ** 2 / bubbles[0].radius ** 2 - bubble.count / bubbles[0].count) < 1e-8);
    }
    for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i], b = bubbles[j];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.radius + b.radius);
    }
    assert.equal(bubbles[0].count, 38);
  }
});

test('filtered groups keep their area ratios within the full overview size cap', () => {
  const entries = Array.from({ length: 120 }, (_, i) => entry(`isolated-${i}`, []));
  entries.push(...Array.from({ length: 38 }, (_, i) => entry(`connected-${i}`, ['a'])));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const graph = relationshipNetwork(entries, records, ids);
  for (const height of [450, 1000, 1600]) {
    const full = relationshipOverview(graph, byId, 1000, height);
    const cap = Math.max(...full.map(group => group.radius));
    for (const groups of [graph.groups.slice(0, 1), graph.groups.slice(0, 4), graph.groups.slice(-1), []]) {
      const filtered = relationshipOverview({ groups }, byId, 1000, height, cap);
      for (const group of filtered) {
        assert.ok(group.radius <= cap + 1e-8);
        assert.ok(Math.abs(group.x) + group.radius <= 500);
        assert.ok(Math.abs(group.y) + group.radius <= height / 2);
        assert.ok(Math.abs(group.radius ** 2 / filtered[0].radius ** 2 - group.count / filtered[0].count) < 1e-8);
      }
      for (let i = 0; i < filtered.length; i++) for (let j = i + 1; j < filtered.length; j++) {
        assert.ok(Math.hypot(filtered[i].x - filtered[j].x, filtered[i].y - filtered[j].y) > filtered[i].radius + filtered[j].radius);
      }
    }
  }
});

test('thick rounded rings retain small categories and keep the source centre clear', async () => {
  for (const parts of [[{ type: 'exposure', fraction: .99 }, { type: 'transmission', fraction: .01 }], [{ type: 'transmission', fraction: 1 }]]) {
    const ring = relationshipRing(50, parts);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="-50 -50 100 100">${ring.parts.map(part => `<defs><clipPath id="${part.type}"><path d="${part.clip}"/></clipPath></defs><path d="${part.path}" stroke="${part.type === 'transmission' ? 'red' : 'black'}" stroke-width="${ring.width}" stroke-linecap="round" fill="none" clip-path="url(#${part.type})"/>`).join('')}</svg>`;
    const image = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    let filled = 0, transmission = 0;
    for (let i = 0; i < image.length; i += 4) {
      const opacity = image[i + 3] / 255;
      filled += opacity;
      transmission += image[i] / 255 * opacity;
    }
    assert.ok(Math.abs(transmission / filled - parts.at(-1)!.fraction) < .003);
    assert.equal(image[(200 * 400 + 200) * 4 + 3], 0);
    assert.ok(filled > 400 * 400 * .28);
  }
});

test('source colours follow identity and source sectors form one solid disc', async () => {
  assert.deepEqual(relationshipSourceColors(['who', 'ecdc', 'rivm']), relationshipSourceColors(['rivm', 'who', 'ecdc']));
  assert.deepEqual(relationshipSourceColors(['who', 'ecdc', 'who', 'rivm']), relationshipSourceColors(['rivm', 'who', 'ecdc']));
  assert.equal(new Set(relationshipSourceColors(Array.from({ length: 16 }, (_, i) => `source-${i}`)).values()).size, 16);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="-50 -50 100 100">${Array.from({ length: 4 }, (_, i) => `<path d="${relationshipWedge(30, i / 4, .25)}" fill="${i === 0 ? 'red' : 'black'}"/>`).join('')}</svg>`;
  const image = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  let area = 0, red = 0;
  for (let i = 0; i < image.length; i += 4) { area += image[i + 3] / 255; red += image[i] / 255 * image[i + 3] / 255; }
  assert.ok(Math.abs(area / (Math.PI * 60 ** 2) - 1) < .005);
  assert.ok(Math.abs(red / area - .25) < .005);
  assert.equal(image[(100 * 200 + 100) * 4 + 3], 255);
});

test('source marks remain separate inside a shared group centre', () => {
  const sources = Array.from({ length: 16 }, (_, i) => `publisher-${i}`);
  assert.deepEqual(relationshipSourceMarks([]), []);
  for (let count = 1; count <= sources.length; count++) {
    const members = sources.slice(0, count), marks = relationshipSourceMarks(members);
    assert.deepEqual(marks, relationshipSourceMarks([...members.toReversed(), members[0]]));
    assert.deepEqual(marks.map(mark => mark.source), members.toSorted());
    for (const mark of marks) {
      assert.ok(Math.hypot(mark.x, mark.y) + mark.scale * 1.1 < 1);
      for (const other of marks) if (other !== mark) assert.ok(Math.hypot(mark.x - other.x, mark.y - other.y) > (mark.scale + other.scale) * 1.1);
    }
  }
});

test('group callouts stay within the canvas and connect the circle and card borders', () => {
  const card = { width: 188, height: 78 };
  for (const frame of [{ width: 610, height: 890 }, { width: 320, height: 420 }, { width: 720, height: 300 }]) {
    for (const [fx, fy] of [[.1, .1], [.9, .1], [.1, .9], [.9, .9], [.5, .5]]) {
      const node = { x: frame.width * fx, y: frame.height * fy, radius: 20 };
      const p = relationshipCallout(node, frame, card);
      assert.ok(p.x >= 8 && p.y >= 8);
      assert.ok(p.x + card.width <= frame.width - 8 && p.y + card.height <= frame.height - 8);
      assert.ok(Math.abs(Math.hypot(p.start.x - node.x, p.start.y - node.y) - node.radius) < 1e-8);
      assert.ok(p.end.x === p.x || p.end.x === p.x + card.width || p.end.y === p.y || p.end.y === p.y + card.height);
      const nearestX = Math.max(p.x, Math.min(node.x, p.x + card.width));
      const nearestY = Math.max(p.y, Math.min(node.y, p.y + card.height));
      assert.ok(Math.hypot(nearestX - node.x, nearestY - node.y) > node.radius);
    }
  }
});

test('expanded sectors preserve evidence edges and contain only their own relationship type', () => {
  const entries = [entry('one', ['a', 'c']), { ...entry('two', ['b']), type: 'transmission' }, entry('three', ['c'])];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const graph = relationshipNetwork(entries, records, ids);
  const group = graph.groups[0];
  const layout = relationshipGroupLayout(group, byId, new Map([['a', '2026-01-01'], ['c', '2026-02-01']]));
  assert.deepEqual(layout.edges.map(edge => edge.id), graph.edges.map(edge => edge.id));
  assert.deepEqual(new Set(layout.nodes.map(node => node.id)), new Set(group.nodes.map(node => node.id)));
  for (const sector of layout.sectors) {
    assert.ok(sector.start < sector.end);
    for (const node of sector.nodes) assert.equal(byId.get(node.reference)!.type, sector.type);
  }
  for (const edge of layout.edges) {
    const from = layout.nodes.find(node => node.id === edge.from)!;
    const to = layout.nodes.find(node => node.id === edge.to)!;
    assert.ok(edge.path.startsWith(`M${from.x} ${from.y}C`));
    assert.ok(edge.path.endsWith(`${to.x} ${to.y}`));
  }
  assert.doesNotMatch(JSON.stringify(layout), /NaN|Infinity/);
});

test('dense groups keep connection controls separated and layouts deterministic', () => {
  const entries = Array.from({ length: 150 }, (_, i) => ({ ...entry(String(i).padStart(3, '0'), ['a']), type: ['exposure', 'transmission', 'unresolved'][i % 3] }));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const group = relationshipNetwork(entries, records, ids).groups[0];
  const layout = relationshipGroupLayout(group, byId, new Map());
  const connections = layout.nodes.filter(node => node.kind === 'relationship');
  for (let i = 0; i < connections.length; i++) for (let j = i + 1; j < connections.length; j++) {
    assert.ok(Math.hypot(connections[i].x - connections[j].x, connections[i].y - connections[j].y) >= 17.99);
  }
  assert.deepEqual(layout, relationshipGroupLayout(relationshipNetwork(entries.toReversed(), records, ids).groups[0], byId, new Map()));
});

test('sector labels follow outer arcs and read from left to right on both halves', () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({ ...entry(String(i), ['a']), type: ['transmission', 'exposure', 'unresolved'][i % 3] }));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const layout = relationshipGroupLayout(relationshipNetwork(entries, records, ids).groups[0], byId, new Map());
  const directions = new Set<number>();
  for (const sector of layout.sectors) {
    const [x1, y1, rx, ry, , large, sweep, x2, y2] = sector.labelArc.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
    assert.equal(rx, sector.radius + 31);
    assert.equal(ry, rx);
    assert.ok(Math.abs(Math.hypot(x1, y1) - rx) < 1e-8);
    assert.ok(Math.abs(Math.hypot(x2, y2) - rx) < 1e-8);
    assert.ok(x1 <= x2 + 1e-8);
    assert.equal(large, 0);
    assert.equal(sweep, Math.sin(sector.middle) > 0 ? 0 : 1);
    directions.add(sweep);
  }
  assert.equal(directions.size, 2);
});

test('sector rotation minimizes the steepest label tangent for balanced and uneven groups', () => {
  const tilt = (angle: number) => Math.asin(Math.abs(Math.cos(angle)));
  for (const angles of [[0], [-.4, .4], [-2, .1, 2.5], [-2.8, -2, -.2, .3, 1.4], [0, Math.PI], [-Math.PI / 2, 0, Math.PI / 2]]) {
    const rotation = relationshipLabelRotation(angles);
    const worst = Math.max(...angles.map(angle => tilt(angle + rotation)));
    for (let i = 0; i < 720; i++) {
      assert.ok(worst <= Math.max(...angles.map(angle => tilt(angle + i * Math.PI / 720))) + 1e-8);
    }
    assert.ok(Math.sin(angles[0] + rotation) <= 1e-8);
  }
  assert.equal(relationshipLabelRotation([]), 0);
});

test('single-type groups put their curved label at the top with a horizontal tangent', () => {
  for (const count of [1, 5, 30, 150]) {
    const entries = Array.from({ length: count }, (_, i) => entry(String(i), ['a']));
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const layout = relationshipGroupLayout(relationshipNetwork(entries, records, ids).groups[0], byId, new Map());
    const sector = layout.sectors[0];
    assert.ok(Math.abs(sector.label.x) < 1e-8);
    assert.ok(sector.label.y < 0);
    assert.ok(Math.abs(Math.cos(sector.middle)) < 1e-8);
  }
});

test('the link clip excludes node bodies and follows each node shape', async () => {
  const samples = {
    report: { inside: [[0, 0], [10, 0], [0, 12]], outside: [[12, 0], [10, 12]] },
    transmission: { inside: [[0, 0], [4, 4]], outside: [[8, 0], [6, 6]] },
    exposure: { inside: [[0, 0], [5, 5]], outside: [[8, 0], [6.5, 6.5]] },
    identity: { inside: [[0, 0], [7, 0]], outside: [[9, 0], [7, 5]] },
    unresolved: { inside: [[0, 0], [3, 4]], outside: [[10, 0], [5, 5]] },
    movement: { inside: [[0, 0], [0, 6]], outside: [[9, 0], [7, 6]] },
  };
  const entries = Object.keys(samples).filter(type => type !== 'report').map(type => ({ ...entry(type, ['a']), type }));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const layout = relationshipGroupLayout(relationshipNetwork(entries, records, ids).groups[0], byId, new Map());
  const width = Math.ceil(layout.radius * 16), extent = 2 * layout.radius;
  const left = layout.center.x - layout.radius, top = layout.center.y - layout.radius;
  const rectangle = `x="${left}" y="${top}" width="${extent}" height="${extent}"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="${left} ${top} ${extent} ${extent}"><defs><clipPath id="edges"><path d="${layout.edgeClip}" clip-rule="evenodd"/></clipPath></defs><rect ${rectangle} fill="white"/><rect ${rectangle} fill="black" clip-path="url(#edges)"/></svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const node of layout.nodes) {
    const shape = node.kind === 'report' ? 'report' : byId.get(node.reference)!.type as keyof typeof samples;
    for (const side of ['inside', 'outside'] as const) for (const [dx, dy] of samples[shape][side]) {
      const x = Math.floor((node.x + dx - left) / extent * info.width);
      const y = Math.floor((node.y + dy - top) / extent * info.height);
      const pixel = data[(y * info.width + x) * info.channels];
      assert.ok(side === 'inside' ? pixel > 240 : pixel < 15, `${shape} ${side} at ${dx},${dy}: ${pixel}`);
    }
  }
});


test('ring expansion keeps circular arcs and matches the group ring at its origin', () => {
  const entries = Array.from({ length: 40 }, (_, i) => ({ ...entry(String(i), ['a']), type: i < 1 ? 'exposure' : i < 12 ? 'unresolved' : 'transmission' }));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const graph = relationshipNetwork(entries, records, ids);
  const bubble = relationshipOverview(graph, byId)[0];
  const ring = relationshipRing(bubble.radius, bubble.parts);
  const layout = relationshipGroupLayout(graph.groups[0], byId, new Map());
  const turn = 2 * Math.PI * Math.round((ring.parts[0].start - layout.sectors[0].start) / (2 * Math.PI));
  for (const part of ring.parts) {
    const sector = layout.sectors.find(sector => sector.type === part.type)!;
    const to = { radius: sector.radius + 14, start: sector.start + turn, end: sector.end + turn };
    assert.equal(relationshipMorphArc(part, to, 0), part.path);
    for (let step = 0; step <= 20; step++) {
      const progress = step / 20;
      const values = relationshipMorphArc(part, to, progress).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
      assert.ok(values.every(Number.isFinite));
      const radius = part.radius + (to.radius - part.radius) * progress;
      for (const offset of [0, 7, 14]) assert.ok(Math.abs(Math.hypot(values[offset], values[offset + 1]) - radius) < 1e-8);
      assert.ok(Math.abs(values[2] - radius) < 1e-8);
      assert.ok(Math.abs(values[9] - radius) < 1e-8);
    }
    const end = relationshipMorphArc(part, to, 1).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)!.map(Number);
    assert.ok(Math.abs(end[0] - to.radius * Math.cos(sector.start)) < 1e-8);
    assert.ok(Math.abs(end[15] - to.radius * Math.sin(sector.end)) < 1e-8);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { healthLayout } from '../src/lib/atlas-health-layout';

test('Evidence routes keep distinct tracks and ports across and within domains', () => {
  const nodes = [{ id: 'a', domain: 'human' }, { id: 'b', domain: 'human' }, { id: 'c', domain: 'food' }, { id: 'd', domain: 'environment' }];
  const edges = [
    { id: '1', from_node_id: 'a', to_node_id: 'c' },
    { id: '2', from_node_id: 'a', to_node_id: 'c' },
    { id: '3', from_node_id: 'b', to_node_id: 'a' },
    { id: '4', from_node_id: 'a', to_node_id: 'd' },
  ];
  for (const width of [240, 800]) {
    const layout = healthLayout(nodes, edges, ['human', 'environment', 'food'], width);
    assert.equal(layout.paths.size, edges.length);
    assert.equal(new Set(layout.paths.values()).size, edges.length);
    assert.deepEqual(layout.paths, healthLayout(nodes, [...edges].reverse(), ['human', 'environment', 'food'], width).paths);
    assert.ok(layout.width >= width);
    for (const path of layout.paths.values()) {
      assert.ok(!/NaN|Infinity/.test(path));
    }
    for (const point of layout.points.values()) assert.ok(point.y + 104 <= layout.height);
    for (const point of layout.points.values()) assert.ok(point.width > 0);
  }
  const noLinks = healthLayout(nodes, [], ['human', 'environment', 'food'], 600);
  assert.equal(noLinks.paths.size, 0);
  assert.equal(noLinks.points.size, nodes.length);
});


test('Independent relationships occupy separate rows without detours', () => {
  const nodes = [{id:'1',domain:'human'}, {id:'2',domain:'food'}, {id:'3',domain:'environment'}, {id:'4',domain:'human'}, {id:'5',domain:'environment'}, {id:'6',domain:'human'}];
  const edges = [{id:'a',from_node_id:'1',to_node_id:'2'}, {id:'b',from_node_id:'4',to_node_id:'3'}];
  const layout = healthLayout(nodes, edges, ['human','environment','food'], 500);
  assert.equal(layout.lanes[0].x, 0);
  assert.equal(layout.lanes.at(-1)!.x + layout.lanes.at(-1)!.width, layout.width);
  assert.equal(layout.points.get('1')!.y, layout.points.get('2')!.y);
  assert.equal(layout.points.get('4')!.y, layout.points.get('3')!.y);
  assert.ok(layout.points.get('4')!.y > layout.points.get('1')!.y + 104);
  assert.ok([...layout.paths.values()].every(path => !path.includes('Q')));
  assert.equal(layout.points.size, nodes.length);
});


test('Parallel routes stay within the outer gutter', () => {
  const nodes = [{id:'a',domain:'human'}, {id:'b',domain:'human'}];
  const edges = Array.from({length:6}, (_, i) => ({id:String(i),from_node_id:'a',to_node_id:'b'}));
  const layout = healthLayout(nodes, edges, ['human'], 300);
  for (const path of layout.paths.values()) {
    const values = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    for (let i=0; i<values.length; i+=2) {
      assert.ok(values[i]>=0 && values[i]<=layout.width);
      assert.ok(values[i+1]>=0 && values[i+1]<=layout.height);
    }
  }
});

test('Adjacent lanes keep two bends across viewport widths and edge directions', () => {
  const domains = ['human', 'environment', 'food'];
  for (const lane of [0, 1]) for (const reverse of [false, true]) {
    const nodes = [
      { id: 'a', domain: domains[lane] },
      { id: 'b', domain: domains[lane + 1] },
      { id: 'c', domain: domains[lane + 1] },
    ];
    const edges = [
      { id: 'ab', from_node_id: 'a', to_node_id: 'b' },
      { id: 'ac', from_node_id: reverse ? 'c' : 'a', to_node_id: reverse ? 'a' : 'c' },
    ];
    for (let width = 240; width <= 900; width += 0.25) {
      const layout = healthLayout(nodes, edges, domains, width);
      const path = layout.paths.get('ac')!;
      assert.equal((path.match(/Q/g) ?? []).length, 2, `lane ${lane}, reverse ${reverse}, width ${width}: ${path}`);
    }
  }
});

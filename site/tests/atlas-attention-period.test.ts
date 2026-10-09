import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attentionSelection } from '../src/lib/atlas-attention';

test('Weekly attention includes both publication boundaries and excludes surrounding days', () => {
  const rows = [
    { id: 'before', publication: '2026-10-01T23:59:59Z' },
    { id: 'first', publication: '2026-10-02T00:00:00Z' },
    { id: 'last', publication: '2026-10-08T23:59:59Z' },
    { id: 'after', publication: '2026-10-09T00:00:00Z' },
    { id: 'undated', publication: '' },
    { id: 'first', publication: '2026-10-02' },
  ];
  const selected = attentionSelection(rows, ['2026-01-01', '2026-10-08'], 7);
  assert.equal(selected.from, '2026-10-02');
  assert.equal(selected.until, '2026-10-08');
  assert.deepEqual([...selected.ids], ['first', 'last']);
});

test('Monthly attention covers thirty days across month, year and leap boundaries', () => {
  for (const [until, from, before] of [
    ['2024-03-01', '2024-02-01', '2024-01-31'],
    ['2025-03-01', '2025-01-31', '2025-01-30'],
    ['2026-01-05', '2025-12-07', '2025-12-06'],
  ]) {
    const selected = attentionSelection([
      { id: 'before', publication: before },
      { id: 'first', publication: from },
      { id: 'last', publication: until },
    ], ['2023-01-01', until], 30);
    assert.equal(selected.from, from);
    assert.equal(selected.until, until);
    assert.deepEqual([...selected.ids], ['first', 'last']);
  }
});

test('Scientific publication days retain UTC boundaries across daylight saving changes', () => {
  for (const [from, until] of [['2026-03-23', '2026-03-29'], ['2026-10-19', '2026-10-25']]) {
    const selected = attentionSelection([
      { id: 'first', publication: `${from}T00:00:00Z` },
      { id: 'last', publication: `${until}T23:30:00Z` },
    ], ['2026-01-01', until], 7);
    assert.equal(selected.from, from);
    assert.equal(selected.until, until);
    assert.deepEqual([...selected.ids], ['first', 'last']);
  }
});

test('Attention periods stay within a short or single-day reporting window', () => {
  const rows = [
    { id: 'outside', publication: '2026-10-05' },
    { id: 'first', publication: '2026-10-06' },
    { id: 'last', publication: '2026-10-08' },
  ];
  for (const days of [7, 30] as const) {
    const selected = attentionSelection(rows, ['2026-10-06', '2026-10-08'], days);
    assert.equal(selected.from, '2026-10-06');
    assert.equal(selected.until, '2026-10-08');
    assert.deepEqual([...selected.ids], ['first', 'last']);
    const oneDay = attentionSelection(rows, ['2026-10-08', '2026-10-08'], days);
    assert.equal(oneDay.from, '2026-10-08');
    assert.deepEqual([...oneDay.ids], ['last']);
  }
});

test('Capture dates cannot include old or undated publications in attention', () => {
  const rows = [
    { id: 'old', publication: '2026-09-01', capture: '2026-10-08' },
    { id: 'undated', publication: '', capture: '2026-10-08' },
    { id: 'published', publication: '2026-10-08', capture: '2026-10-09' },
  ];
  assert.deepEqual([...attentionSelection(rows, ['2026-01-01', '2026-10-08'], 7).ids], ['published']);
  const empty = attentionSelection([], ['2026-10-01', '2026-10-08'], 7);
  assert.equal(empty.from, '2026-10-02');
  assert.equal(empty.until, '2026-10-08');
  assert.equal(empty.ids.size, 0);
});

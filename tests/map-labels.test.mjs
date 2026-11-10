import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visibleLabelIds} from '../lib/mapLabels.js';

const region = (id, x, y, size, nameAr = 'محافظة') => ({id, nameAr, center: [x, y], bounds: [x - size, y - size, x + size, y + size]});

test('overlapping labels: the larger region keeps its name, the smaller one waits for zoom', () => {
  const big = region('big', 44, 15, 1), small = region('small', 44.05, 15.02, 0.1), far = region('far', 50, 15, 0.1);
  const shown = visibleLabelIds([small, big, far], {sizeOf: () => 0.2});
  assert.deepEqual([...shown].sort(), ['big', 'far']);
  // Zoomed in, the same labels are smaller in map units and both fit.
  assert.deepEqual([...visibleLabelIds([small, big, far], {sizeOf: () => 0.005})].sort(), ['big', 'far', 'small']);
});

test('selected and hovered labels always show', () => {
  const big = region('big', 44, 15, 1), small = region('small', 44.05, 15.02, 0.1);
  const shown = visibleLabelIds([big, small], {sizeOf: () => 0.2, pinned: ['small']});
  assert.ok(shown.has('small'));
});

test('the map keeps labels readable on phones and filters overlaps', () => {
  const map = readFileSync(new URL('../components/yemen-map/YemenMap.jsx', import.meta.url), 'utf8');
  assert.ok(map.includes('atLeast(viewBox.width * 0.022 * labelSizeScale, 11)'));
  assert.ok(map.includes('labelItems.filter(item => shownLabels.has(item.id))'));
  assert.ok(map.includes('new ResizeObserver(measure)'));
});

test('main cities are named before larger neighbours', () => {
  const big = region('big', 44, 15, 1), city = region('city', 44.05, 15.02, 0.1);
  assert.deepEqual([...visibleLabelIds([big, city], {sizeOf: () => 0.2, important: ['city']})], ['city']);
});

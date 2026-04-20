import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRouteToKey, formatUnixDate } from '../../.vitepress/theme/utils/last-updated.mjs';

test('normalizeRouteToKey maps folder route to README.md', () => {
  assert.equal(normalizeRouteToKey('/study/rl/'), 'study/rl/README.md');
  assert.equal(normalizeRouteToKey('/'), 'README.md');
});

test('formatUnixDate returns yyyy/mm/dd', () => {
  assert.equal(formatUnixDate(1704067200), '2024/01/01');
});


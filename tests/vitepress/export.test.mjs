import test from 'node:test';
import assert from 'node:assert/strict';
import { toSafeFileName } from '../../.vitepress/theme/utils/export.mjs';

test('toSafeFileName sanitizes route', () => {
  assert.equal(toSafeFileName('/study/rl/?a=1'), 'study-rl');
  assert.equal(toSafeFileName('/'), 'README');
});


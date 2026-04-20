import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../../.vitepress/config.mjs';

test('config uses root base and zh-CN', () => {
  assert.equal(config.base, '/');
  assert.equal(config.lang, 'zh-CN');
});

test('config exposes nav and local search', () => {
  assert.ok(Array.isArray(config.themeConfig.nav));
  assert.equal(config.themeConfig.search.provider, 'local');
});


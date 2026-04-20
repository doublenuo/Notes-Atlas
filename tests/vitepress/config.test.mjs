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

test('config includes concise Chinese footer with GitHub link', () => {
  assert.ok(config.themeConfig.footer);
  assert.match(config.themeConfig.footer.message, /知识库/);
  assert.match(config.themeConfig.footer.copyright, /©\s*2026/);
  assert.match(config.themeConfig.footer.copyright, /<a[^>]+href="https:\/\/github\.com\/doublenuo\/Notes-Atlas"[^>]*>GitHub<\/a>/);
});

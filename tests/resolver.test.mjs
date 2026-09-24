import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createResolver } from '../docs/.vitepress/plugins/obsidianEmbed.ts';

const VAULT = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'vault');
const resolveNote = createResolver(VAULT);

test('论文笔记目录优先于同名全局匹配', () => {
  const r = resolveNote('Alpha');
  assert.ok(r, '应能解析 Alpha');
  assert.equal(r.relPath, '01.组会材料/02.论文笔记/Alpha.md');
});

test('支持带路径的目标（相对 docs 根）', () => {
  const r = resolveNote('02.学习笔记/第三章：测试');
  assert.ok(r);
  assert.equal(r.relPath, '02.学习笔记/第三章：测试.md');
});

test('目标不存在返回 null', () => {
  assert.equal(resolveNote('压根没有这个笔记'), null);
});

test('排除目录（@fragment、.vitepress）不参与解析', () => {
  assert.equal(resolveNote('Trap'), null);
  assert.equal(resolveNote('Trap2'), null);
});

test('可剥掉 .md 后缀', () => {
  const r = resolveNote('Alpha.md');
  assert.equal(r.relPath, '01.组会材料/02.论文笔记/Alpha.md');
});

test('多个同名文件取字典序第一个并告警', () => {
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    const r = resolveNote('重复');
    assert.equal(r?.relPath, '02.学习笔记/重复.md');
    assert.ok(warnings.some((w) => w.includes('重复')), '应有同名告警');
  } finally {
    console.warn = origWarn;
  }
});

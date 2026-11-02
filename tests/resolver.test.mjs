import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createResolver } from '../docs/.vitepress/plugins/obsidianEmbed.js';

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

test('支持相对路径目标（./ 与 ../ 按宿主页源文件目录解析）', () => {
  // 生产 env.realPath 为绝对路径：../02.论文笔记/Alpha 上跳一级命中论文笔记
  const hostAbs = join(VAULT, '01.组会材料/01.组会内容/组会样例.md');
  const r = resolveNote('../02.论文笔记/Alpha', hostAbs);
  assert.ok(r);
  assert.equal(r.relPath, '01.组会材料/02.论文笔记/Alpha.md');

  // 宿主路径也可为相对 docs 根（回退 env.relativePath 场景），两种基准均可
  const rRel = resolveNote('../02.论文笔记/Alpha', '01.组会材料/01.组会内容/组会样例.md');
  assert.ok(rRel);
  assert.equal(rRel.relPath, '01.组会材料/02.论文笔记/Alpha.md');

  // ./ 前缀等价于同目录下解析：宿主页同目录无 Alpha，应 miss
  assert.equal(resolveNote('./Alpha', hostAbs), null);

  // 相同相对目标在不同宿主目录解析结果不同，缓存键须并入宿主上下文
  const fromLearning = resolveNote('../01.组会材料/02.论文笔记/Alpha', '02.学习笔记/第三章：测试.md');
  assert.ok(fromLearning);
  assert.equal(fromLearning.relPath, '01.组会材料/02.论文笔记/Alpha.md');
});

test('目标不存在或越界逃逸 vault 均返回 null', () => {
  assert.equal(resolveNote('压根没有这个笔记'), null);
  // vault 外真实存在的 .md：必须命中 toRel 的 `..` 防护而非 existsSync 分支
  assert.equal(resolveNote('../../../README'), null);
});

test('排除目录（@fragment、.vitepress）不参与解析', () => {
  assert.equal(resolveNote('Trap'), null);
  assert.equal(resolveNote('Trap2'), null);
});

test('可剥掉 .md 后缀', () => {
  const r = resolveNote('Alpha.md');
  assert.ok(r);
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

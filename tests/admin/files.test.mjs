import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFiles } from "../../admin/server/src/files.js";

function mkSite() {
  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "na-site-"));
  const docsDir = path.join(siteDir, "docs");
  fs.mkdirSync(path.join(docsDir, "dir1"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, ".vitepress"), { recursive: true });
  fs.mkdirSync(path.join(docsDir, "public"), { recursive: true });
  fs.writeFileSync(path.join(docsDir, "index.md"), "---\ntitle: 首页\nhero:\n  name: Hi\n---\n# 首页\n");
  fs.writeFileSync(path.join(docsDir, "dir1", "a.md"), "# a\n");
  fs.writeFileSync(path.join(docsDir, ".vitepress", "cfg.md"), "# 隐藏\n");
  fs.writeFileSync(path.join(docsDir, "public", "raw.md"), "# 资源\n");
  fs.writeFileSync(path.join(docsDir, "raw.txt"), "# 非 md\n");
  const gitCalls = [];
  const execGit = async (args) => {
    gitCalls.push(args);
    return "abc1234 admin(x): y";
  };
  const files = createFiles({ docsDir, siteDir, execGit });
  return { siteDir, docsDir, gitCalls, files };
}

test("tree:含 index.md 与 dir1/a.md,排除 .vitepress/public/非 md", async () => {
  const { files } = mkSite();
  const nodes = await files.tree();
  const names = nodes.map((n) => n.name).sort();
  assert.deepEqual(names, ["dir1", "index.md"]);
  const dir = nodes.find((n) => n.name === "dir1");
  assert.equal(dir.type, "dir");
  assert.deepEqual(dir.children.map((c) => c.path), ["dir1/a.md"]);
  assert.equal(nodes.find((n) => n.name === "index.md").path, "index.md");
  const flat = JSON.stringify(nodes);
  assert.ok(!flat.includes("cfg.md") && !flat.includes("raw.md") && !flat.includes("raw.txt"));
});

test("create:模板内容 + git add/commit 两连", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.create("dir1/b.md");
  const content = fs.readFileSync(path.join(docsDir, "dir1", "b.md"), "utf8");
  assert.ok(content.includes("title: b"), "模板 title=文件名(basename 去目录与 .md,规格 §6)");
  assert.ok(content.includes("date:"), "模板带 date");
  const dm = content.match(/^date: '?([^'\n]+)'?$/m);
  assert.ok(dm && Math.abs(Date.parse(dm[1]) - Date.now()) < 120000, "date=当前本地时间(非 UTC,容器 TZ 见 compose)");
  assert.deepEqual(gitCalls[0], ["add", "-A", "docs"]);
  assert.deepEqual(gitCalls[1], ["commit", "-m", "admin(create): dir1/b.md"]);
});

test("create:已存在 → 409", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.create("index.md"), (e) => e.status === 409);
});

test("create:父目录不存在 → 404", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.create("no-such-dir/x.md"), (e) => e.status === 404);
});

test("read:成功返回 content 与 mtime", async () => {
  const { files } = mkSite();
  const r = await files.read("dir1/a.md");
  assert.equal(r.content, "# a\n");
  assert.ok(r.mtime > 0);
});

test("read:缺失→404、目录→400、路径穿文件→404", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.read("missing.md"), (e) => e.status === 404);
  await assert.rejects(() => files.read("dir1"), (e) => e.status === 400, "目录 400 NOT_A_FILE");
  await assert.rejects(() => files.read("index.md/x"), (e) => e.status === 404, "ENOTDIR 归 404");
});

test("write:落盘 + admin(write) commit", async () => {
  const { files, docsDir, siteDir, gitCalls } = mkSite();
  await files.write("index.md", "---\ntitle: 改\n---\n# 改\n");
  assert.equal(fs.readFileSync(path.join(docsDir, "index.md"), "utf8"), "---\ntitle: 改\n---\n# 改\n");
  assert.deepEqual(gitCalls.at(-1), ["commit", "-m", "admin(write): index.md"]);
  // 吞错分支:git 把 "nothing to commit" 打在 stdout(真实 execFile 链路),须视为成功;无关错误必须原样抛出
  const ok = createFiles({ docsDir, siteDir, execGit: async () => {
    throw Object.assign(new Error("Command failed: git commit -m admin(write): index.md"),
      { stdout: "nothing to commit, working tree clean\n", stderr: "", code: 1 });
  } });
  await ok.write("index.md", "---\ntitle: 改\n---\n# 改\n");
  const bad = createFiles({ docsDir, siteDir, execGit: async () => {
    throw Object.assign(new Error("Command failed"),
      { stdout: "", stderr: "fatal: not a git repository\n", code: 128 });
  } });
  await assert.rejects(() => bad.write("index.md", "# x"), (e) => /fatal/.test(e.stderr), "无关错误不得吞");
});

test("write:路径穿越/非 .md → 400(create 同检)", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.write("../evil.md", "x"), (e) => e.status === 400);
  await assert.rejects(() => files.write("raw.txt", "# 非 md"), (e) => e.status === 400, "write 仅接受 .md");
  await assert.rejects(() => files.create("evil.txt"), (e) => e.status === 400, "create 仅接受 .md");
  await assert.rejects(() => files.write("no-such-dir/x.md", "# x"), (e) => e.status === 404, "write 父目录缺失 404");
});

test("removeFile:成功 + admin(delete) commit", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.removeFile("dir1/a.md");
  assert.equal(fs.existsSync(path.join(docsDir, "dir1", "a.md")), false);
  assert.deepEqual(gitCalls.at(-1), ["commit", "-m", "admin(delete): dir1/a.md"]);
});

test("removeFile:缺失 → 404", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.removeFile("missing.md"), (e) => e.status === 404);
});

test("createDir:成功且不调 git;重复 → 409", async () => {
  const { files, docsDir, siteDir, gitCalls } = mkSite();
  await files.createDir("dir2");
  assert.ok(fs.statSync(path.join(docsDir, "dir2")).isDirectory());
  assert.equal(gitCalls.length, 0, "空目录 git 不追踪,不产生提交");
  await assert.rejects(() => files.createDir("dir2"), (e) => e.status === 409);
  assert.equal(await files.lastCommit(), "abc1234 admin(x): y", "状态条:最后一次 commit 摘要");
  const bad = createFiles({ docsDir, siteDir, execGit: async () => { throw new Error("boom"); } });
  assert.equal(await bad.lastCommit(), null, "git 异常 → null");
});

test("removeDir:非空且未 force → 409", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.removeDir("dir1", false), (e) => e.status === 409);
  await assert.rejects(() => files.removeDir("./", true), (e) => e.status === 400, "根目录 force 删除拒绝");
  await assert.rejects(() => files.removeDir("dir1/..", true), (e) => e.status === 400, "归一化后等根亦拒绝");
});

test("removeDir:force 递归删除 + commit", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.removeDir("dir1", true);
  assert.equal(fs.existsSync(path.join(docsDir, "dir1")), false);
  assert.deepEqual(gitCalls.at(-1), ["commit", "-m", "admin(delete): dir1"]);
});

test("rename:成功移动 + commit", async () => {
  const { files, docsDir, gitCalls } = mkSite();
  await files.rename("dir1/a.md", "dir1/a2.md");
  assert.equal(fs.existsSync(path.join(docsDir, "dir1", "a2.md")), true);
  assert.deepEqual(gitCalls.at(-1), ["commit", "-m", "admin(rename): dir1/a.md -> dir1/a2.md"]);
  await files.rename("dir1", "dir2");
  assert.ok(fs.statSync(path.join(docsDir, "dir2")).isDirectory(), "目录改名(规格 §4)");
});

test("rename:目标已存在 → 409", async () => {
  const { files } = mkSite();
  await assert.rejects(() => files.rename("dir1/a.md", "index.md"), (e) => e.status === 409);
});

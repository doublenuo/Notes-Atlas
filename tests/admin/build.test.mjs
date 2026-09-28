import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createBuildQueue, createSpawnRunner } from "../../admin/server/src/build.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeSpawn(code, out) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => {
      child.stdout.emit("data", Buffer.from(out));
      child.emit("close", code);
    });
    return child;
  };
}

test("状态序列 idle→queued→building→success,publish 恰一次", async () => {
  const events = [];
  const queue = createBuildQueue({
    runBuild: async () => {
      events.push("run");
      await sleep(15);
      return "build ok";
    },
    publish: async () => {
      events.push("publish");
    },
    debounceMs: 5,
  });
  assert.equal(queue.status().state, "idle");
  queue.trigger();
  assert.equal(queue.status().state, "queued", "trigger 后进入 queued");
  await sleep(10);
  assert.equal(queue.status().state, "building", "防抖后进入 building");
  await sleep(40);
  assert.equal(queue.status().state, "success");
  assert.deepEqual(events, ["run", "publish"]);
  const s = queue.status();
  assert.ok(s.startedAt > 0 && s.durationMs > 0 && s.publishedAt > 0);
  assert.equal(s.log, "build ok");
  assert.equal(s.queued, false);
});

test("防抖:同一周期内连续三次 trigger 只跑一次", async () => {
  let runs = 0;
  const queue = createBuildQueue({
    runBuild: async () => {
      runs++;
      await sleep(5);
      return "x";
    },
    publish: async () => {},
    debounceMs: 8,
  });
  queue.trigger();
  queue.trigger();
  queue.trigger();
  await sleep(60);
  assert.equal(runs, 1);
});

test("构建中二次触发 → 当前构建后补跑恰好一次(共 2 次)", async () => {
  let runs = 0;
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const queue = createBuildQueue({
    runBuild: async () => {
      runs++;
      if (runs === 1) await gate;
      return `run${runs}`;
    },
    publish: async () => {},
    debounceMs: 5,
  });
  queue.trigger();
  await sleep(15);
  assert.equal(queue.status().state, "building");
  queue.trigger();
  assert.equal(queue.status().queued, true, "构建中触发只标记 queued");
  release();
  await sleep(40);
  assert.equal(runs, 2, "补跑一次");
  assert.equal(queue.status().state, "success");
  await sleep(30);
  assert.equal(runs, 2, "没有第三次");
});

test("runBuild 失败 → failed,且绝不发布", async () => {
  let published = 0;
  const queue = createBuildQueue({
    runBuild: async () => {
      throw Object.assign(new Error("boom"), { log: "错误:坏 YAML" });
    },
    publish: async () => {
      published++;
    },
    debounceMs: 5,
  });
  queue.trigger();
  await sleep(30);
  const s = queue.status();
  assert.equal(s.state, "failed");
  assert.equal(published, 0, "失败不发布");
  assert.equal(s.log, "错误:坏 YAML", "日志来自构建输出");
});

test("publish 失败 → failed(状态携带失败原因)", async () => {
  const queue = createBuildQueue({
    runBuild: async () => "ok",
    publish: async () => {
      throw new Error("docker 拒绝");
    },
    debounceMs: 5,
  });
  queue.trigger();
  await sleep(30);
  const s = queue.status();
  assert.equal(s.state, "failed");
  assert.equal(s.log, "docker 拒绝");
});

test("runner:exit 0 → resolve(合并日志)", async () => {
  const runner = createSpawnRunner({
    command: "echo",
    args: ["hi"],
    cwd: process.cwd(),
    spawnFn: fakeSpawn(0, "构建完成\n"),
  });
  const log = await runner();
  assert.ok(log.includes("构建完成"));
});

test("runner:exit 1 → reject 且携带日志", async () => {
  const runner = createSpawnRunner({
    command: "x",
    args: [],
    cwd: process.cwd(),
    spawnFn: fakeSpawn(1, "错误:坏 YAML\n"),
  });
  await assert.rejects(() => runner(), (e) => e.log.includes("坏 YAML"));
});

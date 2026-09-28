import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createBuildQueue, createSpawnRunner } from "../../admin/server/src/build.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeSpawn(code, out, errOut) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => {
      child.stdout.emit("data", Buffer.from(out));
      if (errOut) child.stderr.emit("data", Buffer.from(errOut));
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
  assert.deepEqual(Object.keys(s), ["state", "queued", "startedAt", "durationMs", "publishedAt", "log"], "status 六字段键名(任务6 build/status 依赖)");
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

test("runBuild 失败 → failed 不发布;e.log 回落、publishedAt 语义、成功轮清日志", async () => {
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

  // 无 e.log 的错误 → 回落 e.message
  const q2 = createBuildQueue({
    runBuild: async () => {
      throw new Error("网络断了");
    },
    publish: async () => {},
    debounceMs: 5,
  });
  q2.trigger();
  await sleep(30);
  assert.equal(q2.status().log, "网络断了");

  // 成功→失败序列:publishedAt 保留最后一次成功发布时间(规格 §5.2 仅成功时更新)
  let round = 0;
  const q3 = createBuildQueue({
    runBuild: async () => {
      round++;
      if (round === 2) throw Object.assign(new Error("second"), { log: "错误:第二次" });
      return "ok";
    },
    publish: async () => {},
    debounceMs: 5,
  });
  q3.trigger();
  await sleep(30);
  const first = q3.status();
  assert.equal(first.state, "success");
  assert.ok(first.publishedAt > 0);
  q3.trigger();
  await sleep(30);
  const second = q3.status();
  assert.equal(second.state, "failed");
  assert.equal(second.log, "错误:第二次");
  assert.equal(second.publishedAt, first.publishedAt, "失败轮保留最后一次成功 publishedAt");
  assert.equal(typeof second.durationMs, "number", "失败轮 durationMs 为到失败点的数值");

  // 失败→成功序列:runBuild 返回非 string → 成功轮 log 清空,不残留上轮错误
  let n = 0;
  const q4 = createBuildQueue({
    runBuild: async () => {
      n++;
      if (n === 1) throw Object.assign(new Error("first"), { log: "错误:旧日志" });
      return undefined;
    },
    publish: async () => {},
    debounceMs: 5,
  });
  q4.trigger();
  await sleep(30);
  assert.equal(q4.status().state, "failed");
  q4.trigger();
  await sleep(30);
  const st = q4.status();
  assert.equal(st.state, "success");
  assert.equal(st.log, "", "成功轮不残留上轮错误日志(非 string 按空处理)");
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

test("runner:exit 0 → resolve(合并 stdout+stderr,尾部裁剪 tailLimit)", async () => {
  const runner = createSpawnRunner({
    command: "echo",
    args: ["hi"],
    cwd: process.cwd(),
    spawnFn: fakeSpawn(0, "HEAD" + "y".repeat(8500), "警告:构建完成\n"),
  });
  const log = await runner();
  assert.ok(log.includes("构建完成"), "stderr 内容并入");
  assert.ok(log.includes("警告"));
  assert.ok(!log.includes("HEAD"), "超出 tailLimit 的头部被裁掉");
  assert.ok(log.length <= 8000, "日志长度受 tailLimit 约束");
});

test("runner:exit 1 → reject 携带日志;spawn ENOENT 与超时同样携带 log", async () => {
  const runner = createSpawnRunner({
    command: "x",
    args: [],
    cwd: process.cwd(),
    spawnFn: fakeSpawn(1, "错误:坏 YAML\n"),
  });
  await assert.rejects(() => runner(), (e) => e.log.includes("坏 YAML"));

  // 真实 spawn:命令不存在 → ENOENT 且 log 为空串
  const missing = createSpawnRunner({ command: "/definitely/not/exist-xyz", args: [], cwd: process.cwd() });
  await assert.rejects(() => missing(), (e) => e.code === "ENOENT" && e.log === "");

  // 真实 spawn:超时先 settle("构建超时"携带已捕获日志)再 SIGKILL,不等 close
  const slow = createSpawnRunner({
    command: process.execPath,
    args: ["-e", "console.log('starting'); setTimeout(() => {}, 10000)"],
    cwd: process.cwd(),
    timeoutMs: 400,
  });
  const t0 = Date.now();
  await assert.rejects(() => slow(), (e) => e.message === "构建超时" && e.log.includes("starting"));
  assert.ok(Date.now() - t0 < 2000, "超时快速拒绝,不等 close");
});

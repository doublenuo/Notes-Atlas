import { spawn } from "node:child_process";

/**
 * 执行一条构建命令:合并捕获 stdout+stderr,只保留尾部 tailLimit 字符;
 * 超时 SIGKILL;exit≠0 / spawn 错误 → reject,错误对象携带 log。
 */
export function createSpawnRunner({ command, args, cwd, timeoutMs = 600000, tailLimit = 8000, spawnFn = spawn }) {
  return function runBuild() {
    return new Promise((resolve, reject) => {
      const child = spawnFn(command, args, { cwd });
      let log = "";
      const push = (d) => {
        log += d;
        if (log.length > tailLimit) log = log.slice(-tailLimit);
      };
      child.stdout?.on("data", (d) => push(String(d)));
      child.stderr?.on("data", (d) => push(String(d)));
      const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(Object.assign(e, { log }));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(log);
        else reject(Object.assign(new Error(`构建进程退出码 ${code}`), { log }));
      });
    });
  };
}

/**
 * 单飞行构建队列。
 * state: idle | queued | building | success | failed
 * queued(bool): 防抖等待中,或构建中标记、待当前构建结束后的补跑请求。
 * 构建成功才 publish;失败保留日志、不回滚 git(规格 §5.3)。
 */
export function createBuildQueue({ runBuild, publish, debounceMs = 5000 }) {
  let state = "idle";
  let queued = false;
  let timer = null;
  let startedAt = null;
  let durationMs = null;
  let publishedAt = null;
  let log = "";

  async function start() {
    if (state === "building") {
      queued = true;
      return;
    }
    state = "building";
    queued = false;
    startedAt = Date.now();
    durationMs = null;
    try {
      const out = await runBuild();
      if (typeof out === "string") log = out;
      await publish();
      publishedAt = Date.now();
      durationMs = publishedAt - startedAt;
      state = "success";
    } catch (e) {
      log = (e && e.log) || (e && e.message) || String(e);
      durationMs = Date.now() - startedAt;
      state = "failed";
    }
    if (queued) start();
  }

  return {
    trigger() {
      if (state === "building") {
        queued = true;
        return;
      }
      state = "queued";
      queued = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        start();
      }, debounceMs);
    },
    status: () => ({ state, queued, startedAt, durationMs, publishedAt, log }),
  };
}

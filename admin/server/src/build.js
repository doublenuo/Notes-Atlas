import { spawn } from "node:child_process";

/**
 * 执行一条构建命令:合并捕获 stdout+stderr,只保留尾部 tailLimit 字符;
 * 超时 → 先以"构建超时"reject(携带当前 log)再 SIGKILL——不等 close,因为 close 要等
 * 持有 stdio 的孙进程退出,孙进程挂死时 Promise 永不 settle 会把队列永久卡在 building;
 * exit≠0 / spawn 错误 → reject,错误对象携带 log。
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
      const timer = setTimeout(() => {
        reject(Object.assign(new Error("构建超时"), { log }));
        child.kill("SIGKILL");
      }, timeoutMs);
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(Object.assign(e, { log }));
      });
      child.on("close", (code, signal) => {
        clearTimeout(timer);
        if (code === 0) resolve(log);
        else {
          const why = code === null ? `构建被信号 ${signal ?? "未知"} 终止` : `构建进程退出码 ${code}`;
          reject(Object.assign(new Error(why), { log }));
        }
      });
    });
  };
}

/**
 * 单飞行构建队列。
 * state: idle | queued | building | success | failed
 * queued(bool): 防抖等待中,或构建中标记、待当前构建结束后的补跑请求。
 * 构建成功才 publish;失败保留日志、不回滚 git(规格 §5.3)。
 *
 * 契约(调用方必须遵守):
 * - runBuild 必须 resolve 构建输出 string;非 string 按空字符串处理(成功轮不残留上轮日志)。
 * - publish 为零参调用,目标目录由构造方闭包注入(见 createArchivePublisher 的 distDir)。
 * - runBuild/publish 内部不得回调 trigger(),否则形成病理性自旋补跑。
 * 语义:
 * - publishedAt = 最后一次成功发布时间:失败轮保留旧值(规格 §5.2 仅成功时更新)。
 * - durationMs:成功 = 构建+发布墙钟,失败 = 到失败点,building 期为 null。
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
      log = typeof out === "string" ? out : "";
      await publish();
      publishedAt = Date.now();
      durationMs = publishedAt - startedAt;
      state = "success";
    } catch (e) {
      log = (e && e.log) || (e && e.message) || String(e);
      durationMs = Date.now() - startedAt;
      state = "failed";
    }
    if (queued) void start(); // start() 内部 try/catch 全包、尾部不得抛,fire-and-forget 不会成 unhandledRejection
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

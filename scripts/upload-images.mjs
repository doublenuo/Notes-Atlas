/**
 * 通过本地图片上传服务上传图片，并可选替换源码中的本地引用。
 *
 * 用法：
 *   pnpm images:upload -- docs/public/images/cos/example.webp
 *   pnpm images:upload -- --replace docs/public/images/cos/example.webp
 *
 * 环境变量：
 *   IMAGE_UPLOAD_URL  上传接口，默认使用阿里云配置
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';

const DEFAULT_UPLOAD_URL = 'http://127.0.0.1:36677/upload?picbed=aliyun&configName=aliyun';
const SOURCE_EXTENSIONS = new Set(['.md', '.ts', '.vue', '.scss', '.css', '.js']);
const replaceReferences = process.argv.includes('--replace');
const inputPaths = process.argv.slice(2).filter((arg) => arg !== '--' && arg !== '--replace');
const uploadUrl = process.env.IMAGE_UPLOAD_URL || DEFAULT_UPLOAD_URL;

if (!inputPaths.length || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    '用法：pnpm images:upload -- [--replace] <图片路径> [...图片路径]\n' +
      `接口：${uploadUrl}`,
  );
  process.exit(inputPaths.length ? 0 : 1);
}

const files = inputPaths.map((inputPath) => {
  const absolutePath = resolve(inputPath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    throw new Error(`图片不存在或不是文件：${inputPath}`);
  }
  return { inputPath, absolutePath };
});

const response = await fetch(uploadUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  // PicList 服务端按自身工作目录解析路径，必须传绝对路径。
  body: JSON.stringify({ list: files.map(({ absolutePath }) => absolutePath) }),
});

let payload;
try {
  payload = await response.json();
} catch {
  throw new Error(`上传接口返回了非 JSON 数据（HTTP ${response.status}）`);
}

if (!response.ok || payload?.success !== true || !Array.isArray(payload?.result)) {
  throw new Error(
    `图片上传失败（HTTP ${response.status}）：${JSON.stringify(payload)}`,
  );
}
if (payload.result.length !== files.length || payload.result.some((url) => typeof url !== 'string' || !url)) {
  throw new Error('图片上传接口返回的 result 数量或 URL 格式无效');
}

const replacements = files.map(({ inputPath, absolutePath }, index) => ({
  inputPath,
  url: payload.result[index],
  publicPath: getPublicPath(absolutePath),
}));

if (replaceReferences) {
  const sources = walk(process.cwd()).filter((file) => SOURCE_EXTENSIONS.has(extname(file)));
  let changedFiles = 0;
  for (const source of sources) {
    const original = readFileSync(source, 'utf8');
    let updated = original;
    for (const { inputPath, publicPath, url } of replacements) {
      updated = updated.split(inputPath).join(url);
      if (publicPath) {
        const localReference = new RegExp(
          `(^|[\\s("'=])/${escapeRegExp(publicPath)}(?=$|[\\s)"'\`])`,
          'gm',
        );
        updated = updated.replace(localReference, `$1${url}`);
      }
    }
    if (updated !== original) {
      writeFileSync(source, updated);
      changedFiles++;
    }
  }
  console.log(`已更新 ${changedFiles} 个源码文件中的图片引用`);
}

for (const { inputPath, url } of replacements) {
  console.log(`${inputPath} -> ${url}`);
}

function getPublicPath(absolutePath) {
  const publicRoot = resolve('docs/public') + sep;
  if (!absolutePath.startsWith(publicRoot)) return '';
  return relative(publicRoot, absolutePath).split(sep).join('/');
}

function walk(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'cache'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path, result);
    else result.push(path);
  }
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

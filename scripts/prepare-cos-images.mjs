/** Convert public image originals to WebP and upload changed WebP objects to Tencent COS. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import COS from 'cos-nodejs-sdk-v5';

const root = fileURLToPath(new URL('../docs/public/images', import.meta.url));
const localOnly = process.env.USE_LOCAL_IMAGES === 'true';
const secretId = process.env.COS_SECRET_ID;
const secretKey = process.env.COS_SECRET_KEY;
const bucket = process.env.COS_BUCKET;
const region = process.env.COS_REGION;
const configured = [secretId, secretKey, bucket, region].filter(Boolean).length;
if (!localOnly && configured > 0 && configured < 4) {
  throw new Error('COS 配置不完整；需设置 COS_SECRET_ID、COS_SECRET_KEY、COS_BUCKET、COS_REGION，或设 USE_LOCAL_IMAGES=true');
}
const upload = !localOnly && configured === 4;
if (process.env.CI === 'true' && !localOnly && !upload) {
  throw new Error('CI 部署需配置 COS_SECRET_ID、COS_SECRET_KEY、COS_BUCKET、COS_REGION；容灾构建可设 USE_LOCAL_IMAGES=true');
}
const cos = upload ? new COS({ SecretId: secretId, SecretKey: secretKey }) : null;
const baseUrl = (process.env.COS_IMAGE_BASE_URL || (bucket && region ? `https://${bucket}.cos.${region}.myqcloud.com` : '')).replace(/\/$/, '');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.(png|jpe?g)$/i.test(entry.name) ? [path] : [];
  });
}

function cosCall(method, params) {
  return new Promise((resolve, reject) => cos[method](params, (err, data) => err ? reject(err) : resolve(data)));
}

let converted = 0;
let uploaded = 0;
let unchanged = 0;
for (const source of walk(root)) {
  const webp = source.replace(/\.(png|jpe?g)$/i, '.webp');
  if (!statSync(webp, { throwIfNoEntry: false }) || statSync(source).mtimeMs > statSync(webp).mtimeMs) {
    execFileSync('convert', [source, '-quality', process.env.WEBP_QUALITY || '85', webp], { stdio: 'inherit' });
    converted++;
  }
}

if (upload) {
  const webpFiles = [];
  function collectWebp(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) collectWebp(path);
      else if (/\.webp$/i.test(entry.name)) webpFiles.push(path);
    }
  }
  collectWebp(root);
  for (const webp of webpFiles) {
    const body = readFileSync(webp);
    const sha256 = createHash('sha256').update(body).digest('hex');
    const key = relative(root, webp).split('\\').join('/');
    let remoteHash = '';
    try {
      const head = await cosCall('headObject', { Bucket: bucket, Region: region, Key: key });
      remoteHash = head.headers?.['x-cos-meta-sha256'] || head.headers?.['X-Cos-Meta-Sha256'] || '';
    } catch (error) {
      if (![404, 'NoSuchKey', 'NotFound'].includes(error.statusCode) && error.code !== 'NoSuchKey') throw error;
    }
    if (remoteHash === sha256) {
      unchanged++;
      continue;
    }
    await cosCall('putObject', {
      Bucket: bucket, Region: region, Key: key, Body: body,
      ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable',
      Metadata: { sha256 },
    });
    uploaded++;
    console.log(`[COS] uploaded ${key}`);
  }
}
console.log(`[images] converted=${converted}, uploaded=${uploaded}, unchanged=${unchanged}, mode=${localOnly ? 'local-fallback' : upload ? 'cos' : 'local-no-credentials'}`);
if (upload && !baseUrl) throw new Error('COS_IMAGE_BASE_URL could not be determined');

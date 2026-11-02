/**
 * markdown 图片尺寸注入插件：为本地图片（public 目录下，如 /images/...）的 <img>
 * 注入 width/height 属性，消除图片加载时的布局偏移（CLS）。
 * 尺寸在构建期从文件头解析（PNG/JPEG/GIF/WebP），按 src 进程内缓存，只读一次。
 * 已有显式 width/height 的图片不覆盖；解析失败或文件缺失时静默跳过。
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { MarkdownRenderer } from "vitepress";

type Dim = { width: number; height: number };

function png(buf: Buffer): Dim | null {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gif(buf: Buffer): Dim | null {
  if (buf.length < 10 || buf.toString("latin1", 0, 3) !== "GIF") return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function jpeg(buf: Buffer): Dim | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    // SOF0-3/5-7/9-11/13-15 段内含尺寸；C4/DHT、C8/JPG、CC/DAC 不是 SOF
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return null;
}

function webp(buf: Buffer): Dim | null {
  if (buf.length < 30 || buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") return null;
  const fmt = buf.toString("latin1", 12, 16);
  if (fmt === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (fmt === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (fmt === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function imageSizePlugin(md: MarkdownRenderer, publicDir: string) {
  const cache = new Map<string, Dim | null>();

  const dimsFor = (src: string): Dim | null => {
    if (cache.has(src)) return cache.get(src) ?? null;
    let dim: Dim | null = null;
    try {
      // 仅处理站点绝对路径（/images/...），协议相对路径 // 与外链不碰
      if (src.startsWith("/") && !src.startsWith("//")) {
        const file = join(publicDir, src);
        if (existsSync(file)) {
          const buf = readFileSync(file);
          dim = png(buf) ?? gif(buf) ?? jpeg(buf) ?? webp(buf);
        }
      }
    } catch {
      // 读文件/解析失败则不注入，保持原渲染
    }
    cache.set(src, dim);
    return dim;
  };

  const raw = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet("src") ?? "";
    const dim = dimsFor(src);
    if (dim && token.attrGet("width") === null && token.attrGet("height") === null) {
      token.attrSet("width", String(dim.width));
      token.attrSet("height", String(dim.height));
    }
    return raw ? raw(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };
}

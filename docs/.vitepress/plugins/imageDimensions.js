/**
 * 从图片文件头解析宽高（PNG / JPEG / GIF / WebP）。
 *
 * 站点构建（imageSize.ts）和尺寸缓存脚本（scripts/cache-image-sizes.mjs）共用，
 * 避免两处解码逻辑漂移。只依赖文件头，不需要完整下载图片。
 */

/**
 * @typedef {{ width: number, height: number }} ImageDimensions
 */

/** @param {Buffer} buf @returns {ImageDimensions | null} */
function png(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** @param {Buffer} buf @returns {ImageDimensions | null} */
function gif(buf) {
  if (buf.length < 10 || buf.toString("latin1", 0, 3) !== "GIF") return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

/** @param {Buffer} buf @returns {ImageDimensions | null} */
function jpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) {
      off++;
      continue;
    }
    const marker = buf[off + 1];
    // SOF0-3/5-7/9-11/13-15 段内含尺寸；C4/DHT、C8/JPG、CC/DAC 不是 SOF
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return null;
}

/** @param {Buffer} buf @returns {ImageDimensions | null} */
function webp(buf) {
  if (buf.length < 30 || buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") {
    return null;
  }
  const fmt = buf.toString("latin1", 12, 16);
  if (fmt === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (fmt === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (fmt === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * 解析图片头；无法识别时返回 null。
 * @param {Buffer} buf
 * @returns {ImageDimensions | null}
 */
export function decodeImageSize(buf) {
  return png(buf) ?? gif(buf) ?? jpeg(buf) ?? webp(buf);
}

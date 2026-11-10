/**
 * 图片 URL 映射扩展点。
 *
 * 当前站点图片已迁到阿里云 OSS/CDN，Markdown 里直接写绝对 URL，
 * 因此这里是恒等函数；保留它便于以后切图床/加处理参数时只改一处。
 */
export function imageUrl(src) {
  return src;
}

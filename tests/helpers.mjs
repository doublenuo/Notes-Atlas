import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createMarkdownRenderer, disposeMdItInstance } from "vitepress";
import { obsidianEmbed } from "../docs/.vitepress/plugins/obsidianEmbed.ts";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const VAULT = join(HERE, "fixtures", "vault");
export const DOCS = join(HERE, "..", "docs");

/** 构建与站点同管线的 md 实例（注册被测插件）。vitepress md 为进程级单例，先释放再按新 root 重建 */
export async function makeMd(root) {
  disposeMdItInstance();
  return createMarkdownRenderer(root, {
    math: true,
    config(md) {
      obsidianEmbed(md, root);
    },
  });
}

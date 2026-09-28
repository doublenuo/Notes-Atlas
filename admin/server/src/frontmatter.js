import matter from "gray-matter";

export const FORM_FIELDS = ["title", "date", "tags", "categories", "sticky"];

/**
 * 解析为 {frontmatter(对象), body(正文)}。
 * 每次返回全新数据(不共享 gray-matter 全局缓存),调用方可安全持有。
 */
export function parseDoc(content) {
  const { data, content: body } = matter(content, {});
  return { frontmatter: data, body };
}

/**
 * 只把表单里出现的已知字段合并进现有 frontmatter,其余键原样透传;正文不动。
 * 契约:①form 缺席或值为 undefined 的键 = 保留原值(部分更新);②值类型 string / string[] / boolean|number;
 * ③返回全新字符串,入参不变;④回写会归一化 frontmatter(注释、引号、数组风格、缩进、日期格式可能被规整)。
 * 传 `{}` 关闭 gray-matter 全局缓存;stringify 传 file 对象,避免把正文再当 frontmatter 解析。
 */
export function applyForm(content, form) {
  const file = matter(content, {});
  for (const k of FORM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(form, k) && form[k] !== undefined) file.data[k] = form[k];
  }
  return matter.stringify(file, file.data);
}

/** 新建文档模板:title=文件名、date=当前时间、tags/categories 空数组。 */
export function buildTemplate(name, nowStr) {
  const title = String(name).replace(/\.md$/, "");
  return matter.stringify(`# ${title}\n`, { title, date: nowStr, tags: [], categories: [] });
}

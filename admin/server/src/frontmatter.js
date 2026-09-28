import matter from "gray-matter";

export const FORM_FIELDS = ["title", "date", "tags", "categories", "sticky"];

/** 解析为 {frontmatter(对象), body(正文)}。 */
export function parseDoc(content) {
  const { data, content: body } = matter(content);
  return { frontmatter: data, body };
}

/** 只把表单里出现的已知字段合并进现有 frontmatter,其余键原样透传;正文不动。 */
export function applyForm(content, form) {
  const { data, content: body } = matter(content);
  for (const k of FORM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(form, k)) data[k] = form[k];
  }
  return matter.stringify(body, data);
}

/** 新建文档模板:title=文件名、date=当前时间、tags/categories 空数组。 */
export function buildTemplate(name, nowStr) {
  const title = String(name).replace(/\.md$/, "");
  return matter.stringify(`# ${title}\n`, { title, date: nowStr, tags: [], categories: [] });
}

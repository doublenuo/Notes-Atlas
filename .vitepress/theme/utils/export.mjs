export function toSafeFileName(routePath) {
  const withoutQuery = String(routePath || '').split('?')[0];
  const cleaned = withoutQuery.replace(/^\/+|\/+$/g, '');
  return (cleaned || 'README')
    .replace(/[\\/:*?"<>|#%{}]+/g, '-')
    .replace(/-+/g, '-');
}

export function makeHtmlDocument(title, bodyHtml) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
  </head>
  <body>
    <main>${bodyHtml}</main>
  </body>
</html>`;
}


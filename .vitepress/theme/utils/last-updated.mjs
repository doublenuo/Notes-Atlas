function pad2(value) {
  return String(value).padStart(2, '0');
}

export function normalizeRouteToKey(routePath) {
  const withoutQuery = String(routePath || '').split('?')[0];
  const clean = withoutQuery.replace(/^\/+|\/+$/g, '');
  if (!clean) return 'README.md';
  if (clean.endsWith('.md')) return clean;
  return `${clean}/README.md`;
}

export function formatUnixDate(unixSeconds) {
  const date = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

export async function readLastUpdatedMap(url = '/static/last-updated.json') {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Failed to fetch last-updated map: ${response.status}`);
  return response.json();
}


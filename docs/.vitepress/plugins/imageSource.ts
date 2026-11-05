const DEFAULT_COS_IMAGE_BASE_URL =
  "https://picupload-1330431167.cos.ap-guangzhou.myqcloud.com";

export function useLocalImages(): boolean {
  const viteValue = typeof import.meta.env !== "undefined" ? import.meta.env.VITE_USE_LOCAL_IMAGES : undefined;
  const nodeValue = typeof process !== "undefined" ? process.env.USE_LOCAL_IMAGES : undefined;
  return (viteValue ?? nodeValue) === "true";
}

export function imageUrl(src: string): string {
  if (useLocalImages() || !src.startsWith("/images/")) return src;

  const viteBaseUrl = typeof import.meta.env !== "undefined" ? import.meta.env.VITE_COS_IMAGE_BASE_URL : undefined;
  const nodeBaseUrl = typeof process !== "undefined" ? process.env.COS_IMAGE_BASE_URL : undefined;
  const configuredBaseUrl = viteBaseUrl ?? nodeBaseUrl;
  const baseUrl = (configuredBaseUrl ?? DEFAULT_COS_IMAGE_BASE_URL).replace(/\/+$/, "");
  return `${baseUrl}${src}`;
}

export { DEFAULT_COS_IMAGE_BASE_URL };

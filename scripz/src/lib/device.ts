// Small, dependency-free device heuristics used to pick sensible engine defaults.

export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|opr|android/i.test(ua);
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uaData = (navigator as any).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  const ua = navigator.userAgent;
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return true;
  // iPadOS reports itself as a Mac but has a touch screen.
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

export function prefersReducedData(): boolean {
  if (typeof navigator === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = (navigator as any).connection;
  return Boolean(conn?.saveData) || /(^|-)2g$/.test(String(conn?.effectiveType ?? ""));
}

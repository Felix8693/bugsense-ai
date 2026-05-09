export function getVisitorId(): string {
  if (typeof window === "undefined") return "";

  const key = "bugsense_vid";
  let vid = localStorage.getItem(key);
  if (!vid) {
    vid = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    localStorage.setItem(key, vid);
  }
  return vid;
}

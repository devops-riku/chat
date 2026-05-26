/** Convert a display name to a URL-safe channel slug (a-z, 0-9, hyphens). */
export function slugifyChannelName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128);
}

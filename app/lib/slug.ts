/** Single source of truth for company web-address slugs (client + server). */
export const SLUG_PATTERN = "[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?";
export const SLUG_RE = new RegExp(`^${SLUG_PATTERN}$`);

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

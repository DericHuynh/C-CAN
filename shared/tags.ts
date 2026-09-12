/** e621 spelling: lowercase names with underscores between words. */
export function normalizeTag(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "_");
}
export function normalizeTagList(values: string[]): string[] {
  return [...new Set(values.map(normalizeTag).filter(Boolean))].sort();
}
export const TAG_CATEGORIES: Record<number, string> = {
  0: "General",
  1: "Artist",
  3: "Copyright",
  4: "Character",
  5: "Species",
  6: "Invalid",
  7: "Meta",
  8: "Lore",
};
export interface CatalogTag {
  id: number;
  name: string;
  category: number;
  postCount: number;
  updatedAt: string;
}

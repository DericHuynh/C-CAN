/** Search metadata deliberately omits image/audio payloads and styling objects. */
export interface ContentEntry {
  id: string;
  label: string;
  text: string;
  tags: string[];
  type: string;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
  hasRequirements?: boolean;
}
export interface ContentFilter {
  query: string;
  tag: string;
  type: string;
  sort: string;
  from: string;
  to: string;
  has: string;
}
export const emptyContentFilter: ContentFilter = {
  query: "",
  tag: "",
  type: "",
  sort: "order",
  from: "",
  to: "",
  has: "",
};
const plain = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
const recordedDate = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined;
export function describeContent(item: any, index: number): ContentEntry {
  const text = [
    item?.name,
    item?.title,
    item?.label,
    item?.id,
    item?.text,
    item?.titleText,
    item?.description,
    item?.source,
    item?.sourceTooltip,
    item?.replaceText,
    item?.beforeText,
    item?.afterText,
  ];
  for (const child of [
    ...(Array.isArray(item?.objects) ? item.objects : []),
    ...(Array.isArray(item?.addons) ? item.addons : []),
  ])
    text.push(
      child?.title,
      child?.text,
      child?.id,
      ...(Array.isArray(child?.addons) ? child.addons : []).flatMap((a: any) => [
        a?.title,
        a?.text,
        a?.id,
      ]),
    );
  return {
    id: String(item?.id ?? index),
    label: plain(item?.name || item?.title || item?.label || item?.id) || `Item ${index + 1}`,
    text: text.map(plain).join(" ").toLocaleLowerCase(),
    tags: [
      ...(Array.isArray(item?.tags) ? item.tags : []),
      ...(Array.isArray(item?.groups) ? item.groups : []),
    ].filter((s: unknown) => typeof s === "string"),
    type: String(
      item?.type ??
        (typeof item?.isTrue === "boolean"
          ? item.isTrue
            ? "True"
            : "False"
          : item?.isSelectableMultiple
            ? "Multiple selection"
            : item?.isInfoRow
              ? "Information"
              : item?.objects
                ? "Row"
                : ""),
    ),
    image: typeof item?.image === "string" ? item.image : undefined,
    createdAt: recordedDate(item?.createdAt),
    updatedAt: recordedDate(item?.updatedAt),
    hasRequirements: Boolean(item?.requireds?.length),
  };
}
function matches(text: string, token: string) {
  if (text.includes(token)) return true;
  // Typo-tolerant ordered characters, restricted to words to avoid unrelated long-prose matches.
  if (token.length < 3 || /\d/.test(token)) return false;
  return text.split(/\s+/).some((word) => {
    if (word.length > token.length + 3) return false;
    let i = 0;
    for (const c of word) if (c === token[i]) i++;
    if (i === token.length) return true;
    if (token.length < 4 || Math.abs(word.length - token.length) > 1) return false;
    // One substitution, insertion, deletion or adjacent transposition.
    let offset = 0;
    while (offset < Math.min(word.length, token.length) && word[offset] === token[offset]) offset++;
    if (word.length === token.length)
      return (
        word.slice(offset + 1) === token.slice(offset + 1) ||
        (word[offset] === token[offset + 1] &&
          word[offset + 1] === token[offset] &&
          word.slice(offset + 2) === token.slice(offset + 2))
      );
    return word.length > token.length
      ? word.slice(offset + 1) === token.slice(offset)
      : word.slice(offset) === token.slice(offset + 1);
  });
}
export function filterContent<T>(
  entries: readonly { item: T; meta: ContentEntry; index: number }[],
  filter: ContentFilter,
) {
  const terms = filter.query.toLocaleLowerCase().match(/-?"[^"]+"|\S+/g) ?? [];
  const filtered = entries.filter(({ meta: m }) => {
    if ((filter.tag && !m.tags.includes(filter.tag)) || (filter.type && m.type !== filter.type))
      return false;
    if (
      (filter.has === "image" && !m.image) ||
      (filter.has === "no-image" && m.image) ||
      (filter.has === "requirements" && !m.hasRequirements)
    )
      return false;
    const date = m.createdAt?.slice(0, 10);
    if (
      (filter.from || filter.to) &&
      (!date || (filter.from && date < filter.from) || (filter.to && date > filter.to))
    )
      return false;
    return terms.every((raw) => {
      const exclude = raw.startsWith("-"),
        term = (exclude ? raw.slice(1) : raw).replace(/^"|"$/g, "");
      const hit = term.startsWith("tag:")
        ? m.tags.some((t) => t.toLowerCase() === term.slice(4))
        : raw.includes('"')
          ? (m.text + " " + m.tags.join(" ").toLowerCase()).includes(term)
          : matches(m.text + " " + m.tags.join(" ").toLowerCase(), term);
      return exclude ? !hit : hit;
    });
  });
  return filtered.sort((a, b) => {
    if (filter.sort === "name") return a.meta.label.localeCompare(b.meta.label);
    if (filter.sort === "name-desc") return b.meta.label.localeCompare(a.meta.label);
    if (filter.sort === "newest" || filter.sort === "oldest") {
      const date =
        (a.meta.createdAt ?? "").localeCompare(b.meta.createdAt ?? "") || a.index - b.index;
      return filter.sort === "newest" ? -date : date;
    }
    if (filter.sort === "updated")
      return (
        (b.meta.updatedAt ?? b.meta.createdAt ?? "").localeCompare(
          a.meta.updatedAt ?? a.meta.createdAt ?? "",
        ) || b.index - a.index
      );
    return a.index - b.index;
  });
}

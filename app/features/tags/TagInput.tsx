import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useActionQuery } from "@agent-native/core/client/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeTag, normalizeTagList, TAG_CATEGORIES } from "@shared/tags";

/** Shared editor/explorer tag control. Global suggestions contain public e621 data only. */
export function TagInput({
  value,
  onChange,
  label = "Tags",
  id,
  max = 200,
  localSuggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  id?: string;
  max?: number;
  localSuggestions?: string[];
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = inputId + "-suggestions";
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const { data, isFetching } = useActionQuery(
    "search-tags",
    { query: normalizeTag(debounced), limit: 12 },
    { enabled: open, staleTime: 300_000, retry: false },
  );
  const selected = useMemo(() => new Set(value.map(normalizeTag)), [value]);
  const suggestions = useMemo(() => {
    const q = normalizeTag(query);
    const found = new Map<string, { name: string; detail: string }>();
    for (const tag of localSuggestions) {
      const name = normalizeTag(tag);
      if (name.startsWith(q) && !selected.has(name)) found.set(name, { name, detail: "Used here" });
    }
    if (normalizeTag(debounced) === q)
      for (const tag of data?.items ?? [])
        if (!selected.has(tag.name))
          found.set(tag.name, {
            name: tag.name,
            detail: `${TAG_CATEGORIES[tag.category] || "Tag"} · ${tag.postCount.toLocaleString()} posts`,
          });
    const result = [...found.values()].slice(0, 10);
    if (q && !selected.has(q) && !found.has(q)) result.push({ name: q, detail: "Use this tag" });
    return result;
  }, [query, debounced, data, localSuggestions, selected]);
  useEffect(() => setActive(-1), [query]);
  useEffect(() => {
    if (open && active >= 0)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);
  function add(raw: string) {
    const tag = normalizeTag(raw);
    if (!tag || tag.length > 128 || selected.has(tag) || value.length >= max) return;
    onChange(normalizeTagList([...value, tag]));
    setQuery("");
    setActive(-1);
  }
  const visible = expanded ? value : value.slice(0, 12);
  return (
    <div
      ref={root}
      className="min-w-0 space-y-2"
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((tag, index) => (
          <button
            key={`${tag}-${index}`}
            type="button"
            className="max-w-full break-all rounded-full border bg-muted px-2 py-1 text-xs hover:bg-accent"
            aria-label={`Remove ${tag} from ${label}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            {tag} <span aria-hidden>×</span>
          </button>
        ))}
        {value.length > 12 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show fewer" : `Show ${value.length - 12} more`}
          </Button>
        )}
      </div>
      <Input
        id={inputId}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-activedescendant={
          open && active >= 0 && suggestions[active] ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        value={query}
        maxLength={128}
        placeholder={value.length >= max ? `Maximum ${max} tags` : "Search tags…"}
        disabled={value.length >= max}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((i) =>
              event.key === "ArrowDown"
                ? Math.min(i + 1, suggestions.length - 1)
                : Math.max(i - 1, 0),
            );
          } else if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            add(suggestions[active]?.name || query);
          }
        }}
      />
      {open && (
        <div className="space-y-1 rounded-md border bg-popover p-1 text-popover-foreground">
          <div
            id={listId}
            role="listbox"
            aria-label={`${label} suggestions`}
            className="max-h-48 overflow-y-auto"
          >
            {suggestions.map((tag, index) => (
              <button
                id={`${listId}-${index}`}
                key={tag.name}
                type="button"
                role="option"
                aria-selected={active === index}
                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent ${active === index ? "bg-accent" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(tag.name)}
              >
                <span className="min-w-0 break-all">{tag.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{tag.detail}</span>
              </button>
            ))}
          </div>
          {isFetching && (
            <p role="status" className="px-2 text-xs text-muted-foreground">
              Looking up tags…
            </p>
          )}
          {data?.warning && (
            <p role="status" className="px-2 text-xs text-muted-foreground">
              {data.warning}
            </p>
          )}
          <p className="px-2 text-[10px] text-muted-foreground">
            Suggestions from e621. Enter adds a tag.
          </p>
        </div>
      )}
    </div>
  );
}

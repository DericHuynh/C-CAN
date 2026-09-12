import { useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { IconSearch } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import { cn } from "@/lib/utils";
import {
  getProjectSearchEntries,
  isEnabled,
  type ProjectSearchEntry,
  type ProjectSearchType,
} from "@shared/cyoa-engine";
import type { Choice, Requireds, Row } from "@shared/types";
import type { ViewerTarget } from "@shared/viewer-feedback";

export interface ViewerSearchBarHandle {
  focus: () => void;
}

const SEARCH_FILTERS: { value: ProjectSearchType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "choice", label: "Choices" },
  { value: "addon", label: "Addons" },
  { value: "row", label: "Rows" },
  { value: "point", label: "Points" },
  { value: "group", label: "Groups" },
  { value: "globalRequirement", label: "Reqs" },
  { value: "word", label: "Words" },
];

/**
 * Project-wide search bar: filters the whole document (choices, addons,
 * rows, point types, groups, global requirements, words) by kind and query,
 * then jumps to the match without changing player selections, scrolling to the
 * first choice that references non-visual entities.
 */
export function ViewerSearchBar({
  cyoa,
  ref,
  onJump,
}: {
  cyoa: UseCyoaResult;
  ref?: Ref<ViewerSearchBarHandle>;
  onJump: (target: ViewerTarget) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectSearchType | "all">("all");
  const [open, setOpen] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
    }),
    [],
  );

  const entries = useMemo(() => getProjectSearchEntries(cyoa.app), [cyoa.app]);

  // First choice that references each point/group/global-requirement/word, so
  // those results can still "jump" somewhere useful in the rendered viewer.
  const referenceTargets = useMemo(() => {
    const map = new Map<string, { choice: Choice; row: Row }>();
    const setFirst = (id: string | undefined, target: { choice: Choice; row: Row }) => {
      if (!id || map.has(id)) return;
      map.set(id, target);
    };
    for (const row of cyoa.app.rows ?? []) {
      for (const choice of row.objects ?? []) {
        const target = { choice, row };
        const walk = (requireds: Requireds[] | undefined) => {
          for (const req of requireds ?? []) {
            if (req.type === "or") walk(req.orRequireds);
            else if (req.type === "points" || req.type === "gid" || req.type === "word") {
              setFirst(req.reqId, target);
            }
          }
        };
        walk(choice.requireds);
        for (const groupId of choice.groups ?? []) setFirst(groupId, target);
        for (const score of choice.scores ?? []) setFirst(score.id, target);
      }
    }
    return map;
  }, [cyoa.app]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return entries
      .filter((entry) => (filter === "all" ? true : entry.type === filter))
      .filter((entry) => {
        // Only list jumpable entities: choices/addons/rows live in rows that
        // are currently enabled — hidden rows aren't in the DOM, so "jump"
        // couldn't reach them. The list refreshes live as rows unlock.
        if (entry.type === "choice" || entry.type === "addon") {
          return entry.row ? isEnabled(entry.row.requireds, cyoa.idx, cyoa.state) : true;
        }
        if (entry.type === "row") {
          return entry.row ? isEnabled(entry.row.requireds, cyoa.idx, cyoa.state) : true;
        }
        return true;
      })
      .filter(
        (entry) =>
          entry.id.toLowerCase().includes(q) ||
          entry.label.toLowerCase().includes(q) ||
          entry.kindLabel.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [entries, query, filter, cyoa.idx, cyoa.state]);

  function jumpTo(entry: ProjectSearchEntry) {
    if (entry.type === "row") onJump({ rowId: entry.id });
    else if (entry.type === "choice") onJump({ rowId: entry.row?.id, choiceId: entry.id });
    else if (entry.type === "addon")
      onJump({ rowId: entry.row?.id, choiceId: entry.parentId, addonId: entry.id });
    else {
      const target = referenceTargets.get(entry.id);
      if (target) onJump({ rowId: target.row.id, choiceId: target.choice.id });
    }
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div
      data-viewer-controls
      className={cn(
        "sticky top-0",
        "z-30 border-b border-border/60 bg-background/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:px-6",
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              } else if (event.key === "Enter" && results.length > 0) {
                jumpTo(results[0]);
              }
            }}
            placeholder="Search choices, rows, addons…"
            aria-label="Search project"
            className="pl-8"
          />
          {open && query.trim() ? (
            <div
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
              onMouseDown={(event) => event.preventDefault()}
            >
              {results.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches.</p>
              ) : (
                results.map((entry) => (
                  <button
                    key={`${entry.type}:${entry.id}`}
                    type="button"
                    onClick={() => jumpTo(entry)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      {entry.kindLabel}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {entry.id}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Search filters">
          {SEARCH_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                filter === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
              aria-pressed={filter === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Point bar                                                          */
/* ------------------------------------------------------------------ */

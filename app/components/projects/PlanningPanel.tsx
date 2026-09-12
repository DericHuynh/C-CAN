import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { Link, useSearchParams } from "react-router";
import { useT } from "@agent-native/core/client/i18n";
import { toast } from "sonner";
import { IconChevronDown, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAddRow,
  useAddChoice,
  useUpdatePlanningEntry,
  type ProjectDetail,
} from "@/hooks/use-projects";
import {
  planningDraft,
  planningEntries,
  planningKey,
  planningSearchText,
  planningUrl,
  livePlanningText,
  PLAN_STATUSES,
  type PlanningDraft,
  type PlanningEntry,
  type PlanningTarget,
} from "@shared/planning";
import { cn } from "@/lib/utils";
import { PlanningRequirements } from "./PlanningRequirements";
import { sanitizeHtml } from "./cyoa-styles";

const PlanningProseEditor = lazy(() =>
  import("./PlanningProseEditor").then((module) => ({ default: module.PlanningProseEditor })),
);

export function PlanningPanel({ project }: { project: ProjectDetail }) {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const entries = useMemo(() => planningEntries(project.app), [project.app]);
  const index = useMemo(
    () => entries.map((entry) => ({ entry, search: planningSearchText(entry) })),
    [entries],
  );
  const branches = useMemo(() => new Set(entries.map((entry) => entry.parentKey)), [entries]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const addRow = useAddRow();
  const addChoice = useAddChoice();
  const target = {
    rowId: params.get("rowId") ?? "",
    choiceId: params.get("choiceId") ?? undefined,
    addonId: params.get("addonId") ?? undefined,
  };
  const selected =
    entries.find((entry) => entry.key === planningKey(target)) ??
    (!target.rowId ? entries[0] : undefined);
  useEffect(() => {
    if (!selected) return;
    if (!target.rowId)
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("rowId", selected.target.rowId);
          return next;
        },
        { replace: true },
      );
    setExpanded(
      (current) =>
        new Set([
          ...current,
          planningKey({ rowId: selected.target.rowId }),
          ...(selected.target.choiceId
            ? [planningKey({ rowId: selected.target.rowId, choiceId: selected.target.choiceId })]
            : []),
        ]),
    );
  }, [selected?.key]);
  const filtering = !!query.trim() || filter !== "all";
  const visible = useMemo(() => {
    if (filtering)
      return index
        .filter(
          ({ entry, search }) =>
            (!query.trim() || search.includes(query.trim().toLocaleLowerCase())) &&
            (filter === "all" ||
              (filter === "art"
                ? ["needed", "research"].includes(planningDraft(entry).imageStatus)
                : planningDraft(entry).status === filter)),
        )
        .map(({ entry }) => entry);
    return entries.filter(
      (entry) =>
        entry.depth === 0 ||
        (expanded.has(planningKey({ rowId: entry.target.rowId })) &&
          (entry.depth === 1 || expanded.has(entry.parentKey!))),
    );
  }, [entries, index, query, filter, filtering, expanded, selected?.key]);
  const lastRevealed = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selected || lastRevealed.current === selected.key) return;
    const at = visible.findIndex((entry) => entry.key === selected.key);
    if (at >= 0) {
      setPage(Math.floor(at / 80));
      lastRevealed.current = selected.key;
    }
  }, [selected?.key, visible]);
  const pages = Math.max(1, Math.ceil(visible.length / 80));
  const safePage = Math.min(page, pages - 1);
  function select(next: PlanningTarget) {
    setParams((current) => {
      const result = new URLSearchParams(current);
      result.set("rowId", next.rowId);
      for (const key of ["choiceId", "addonId"] as const) {
        if (next[key]) result.set(key, next[key]!);
        else result.delete(key);
      }
      return result;
    });
  }
  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  async function create(kind: "row" | "choice") {
    try {
      if (kind === "row") {
        const result = await addRow.mutateAsync({ projectId: project.id });
        if (result.row) select({ rowId: result.row.id });
      } else if (selected) {
        const result = await addChoice.mutateAsync({
          projectId: project.id,
          rowId: selected.target.rowId,
        });
        if (result.choice) select({ rowId: selected.target.rowId, choiceId: result.choice.id });
      }
      setQuery("");
      setFilter("all");
      setPage(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("planning.saveFailed"));
    }
  }
  const ready = entries.filter((entry) => planningDraft(entry).status === "ready").length;
  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
      <aside
        data-planning-outline
        className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3 xl:sticky xl:top-4"
        aria-label={t("planning.outline")}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t("planning.outline")}</h2>
          <span className="text-xs text-muted-foreground">
            {t("planning.readyCount", { ready, total: entries.length })}
          </span>
        </div>
        <Input
          aria-label={t("planning.search")}
          placeholder={t("planning.search")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
        <Select
          value={filter}
          onValueChange={(value) => {
            setFilter(value);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full" aria-label={t("planning.filter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {["all", ...PLAN_STATUSES, "art"].map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`planning.${value}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <nav
          className="max-h-72 overflow-y-auto xl:max-h-[calc(100dvh-440px)]"
          aria-label={t("planning.entries")}
        >
          {visible.slice(safePage * 80, safePage * 80 + 80).map((entry) => (
            <div
              key={entry.key}
              className={cn(
                "flex min-w-0 items-start rounded",
                entry.key === selected?.key && "bg-accent",
                entry.depth === 1 && "ms-3",
                entry.depth === 2 && "ms-6",
              )}
            >
              {!filtering && branches.has(entry.key) ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-1.5 hover:bg-accent focus-visible:ring-2"
                  aria-label={t("planning.toggleSection", {
                    title: entry.entity.title || entry.entity.id,
                  })}
                  aria-expanded={expanded.has(entry.key)}
                  onClick={() => toggle(entry.key)}
                >
                  {expanded.has(entry.key) ? (
                    <IconChevronDown size={15} />
                  ) : (
                    <IconChevronRight size={15} />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                aria-current={entry.key === selected?.key ? "true" : undefined}
                className="min-w-0 flex-1 rounded px-2 py-1.5 text-start hover:bg-accent focus-visible:ring-2"
                onClick={() => select(entry.target)}
              >
                <span className="block truncate text-sm">
                  {planningDraft(entry).title || t(`planning.untitled${entry.kind}`)}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {entry.entity.id} · {t(`planning.${planningDraft(entry).status}`)}
                </span>
              </button>
            </div>
          ))}
          {!visible.length && (
            <p className="p-3 text-sm text-muted-foreground">
              {t(entries.length ? "planning.noMatches" : "planning.empty")}
            </p>
          )}
        </nav>
        {pages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!safePage}
              onClick={() => setPage(safePage - 1)}
            >
              {t("planning.previous")}
            </Button>
            <span className="text-xs">
              {safePage + 1} / {pages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage + 1 >= pages}
              onClick={() => setPage(safePage + 1)}
            >
              {t("planning.next")}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={addRow.isPending}
            onClick={() => create("row")}
          >
            <IconPlus size={14} />
            {t("planning.addSection")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!selected || addChoice.isPending}
            onClick={() => create("choice")}
          >
            {t("planning.addChoice")}
          </Button>
        </div>
      </aside>
      {selected ? (
        <PlanningDocument
          key={`${project.id}:${selected.key}:${planningDraft(selected).revision}`}
          project={project}
          entry={selected}
          select={select}
          entries={entries}
        />
      ) : (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          {t(target.rowId ? "planning.missing" : "planning.start")}
        </div>
      )}
    </div>
  );
}

function PlanningDocument({
  project,
  entry,
  entries,
  select,
}: {
  project: ProjectDetail;
  entry: PlanningEntry;
  entries: PlanningEntry[];
  select: (target: PlanningTarget) => void;
}) {
  const t = useT();
  const mutation = useUpdatePlanningEntry();
  const saved = planningDraft(entry);
  const storageKey = `cyoa-planning:${project.id}:${entry.key}`;
  const [recovered, setRecovered] = useState(false);
  const [draft, setDraft] = useState<PlanningDraft>(saved);
  const [source, setSource] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);
  const latest = useRef(draft);
  latest.current = draft;
  const documentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const value = localStorage.getItem(storageKey);
      if (value) {
        const parsed = JSON.parse(value);
        if (
          typeof parsed.text === "string" &&
          typeof parsed.title === "string" &&
          Number.isInteger(parsed.revision)
        ) {
          const restored = { ...saved, ...parsed };
          if (JSON.stringify(restored) !== JSON.stringify(saved)) {
            setDraft(restored);
            setRecovered(true);
          } else localStorage.removeItem(storageKey);
        }
      }
    } catch {
      setStorageFailed(true);
    }
    if (window.matchMedia("(max-width: 1279px)").matches)
      documentRef.current?.scrollIntoView({ block: "start" });
  }, [storageKey]);
  function change(patch: Partial<PlanningDraft>) {
    const next = { ...latest.current, ...patch };
    if (JSON.stringify(next) === JSON.stringify(latest.current)) return;
    latest.current = next;
    setDraft(next);
    try {
      if (JSON.stringify(next) === JSON.stringify(saved)) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setStorageFailed(true);
    }
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const live = livePlanningText(entry);
  const liveChanged = live.title !== draft.baseTitle || live.text !== draft.baseText;
  async function save(applyToContent = false, resetTextToCurrent = false) {
    if (mutation.isPending) return;
    try {
      const { title, text, notes, mechanics, imageNotes, status, imageStatus } = latest.current;
      const result = await mutation.mutateAsync({
        projectId: project.id,
        ...entry.target,
        expectedRevision: latest.current.revision,
        base: { title: latest.current.baseTitle, text: latest.current.baseText },
        patch: { title, text, notes, mechanics, imageNotes, status, imageStatus },
        applyToContent,
        resetTextToCurrent,
      });
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* Saved on server. */
      }
      setDraft(result.draft);
      latest.current = result.draft;
      setRecovered(false);
      toast.success(t(applyToContent ? "planning.applied" : "planning.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("planning.saveFailed"));
    }
  }
  const parent = entry.parentKey ? entries.find((item) => item.key === entry.parentKey) : undefined;
  const children = entries.filter((item) => item.parentKey === entry.key);
  const resource = project.app.images.find((image) => image.id === entry.entity.image);
  const urls = [...new Set(draft.imageNotes.match(/https?:\/\/[^\s<>"']+/g) ?? [])];
  useSaveShortcut(
    documentRef,
    () => {
      void save();
    },
    !mutation.isPending,
  );
  return (
    <div ref={documentRef} className="min-w-0 rounded-lg border bg-background">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-lg border-b bg-background p-3">
        <Button
          variant="ghost"
          size="sm"
          className="xl:hidden"
          onClick={() =>
            document.querySelector("[data-planning-outline]")?.scrollIntoView({ block: "start" })
          }
        >
          {t("planning.outline")}
        </Button>
        <span role="status" className="me-auto text-xs text-muted-foreground">
          {t(dirty ? "planning.unsaved" : "planning.savedState")}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setReloadOpen(true)}
          disabled={mutation.isPending}
        >
          {t("planning.reload")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => save()} disabled={mutation.isPending}>
          {t("planning.save")}
        </Button>
        <Button size="sm" onClick={() => save(true)} disabled={mutation.isPending || liveChanged}>
          {t("planning.apply")}
        </Button>
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 p-4 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="break-all text-muted-foreground">{entry.entity.id}</span>
          {parent && (
            <button type="button" className="underline" onClick={() => select(parent.target)}>
              {planningDraft(parent).title || parent.entity.id}
            </button>
          )}
          <Link className="ms-auto underline" to={planningUrl(project.id, entry.target, "rows")}>
            {t("planning.editMechanics")}
          </Link>
          <Link
            className="underline"
            to={`${planningUrl(project.id, entry.target, "plan", "viewer")}#${encodeURIComponent(entry.target.choiceId ?? entry.target.rowId)}`}
          >
            {t("planning.play")}
          </Link>
        </div>
        {recovered && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("planning.recovered")}
          </p>
        )}
        {storageFailed && (
          <p role="alert" className="text-sm text-destructive">
            {t("planning.storageFailed")}
          </p>
        )}
        {draft.revision !== saved.revision && (
          <p role="alert" className="text-sm text-destructive">
            {t("planning.conflict")}
          </p>
        )}
        {liveChanged && (
          <div className="rounded-md border p-3 text-sm">
            <p>{t("planning.liveChanged")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setResetOpen(true)}
              disabled={mutation.isPending}
            >
              {t("planning.useCurrent")}
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="plan-title">{t("planning.title")}</Label>
          <Input
            id="plan-title"
            className="h-auto py-2 text-xl font-semibold"
            value={draft.title}
            onChange={(event) => change({ title: event.target.value })}
            disabled={mutation.isPending}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Label>{t("planning.status")}</Label>
          <Select
            value={draft.status}
            onValueChange={(status) => change({ status: status as PlanningDraft["status"] })}
            disabled={mutation.isPending}
          >
            <SelectTrigger aria-label={t("planning.status")} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PLAN_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`planning.${status}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{t("planning.editorialStatus")}</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={source ? "plan-source" : undefined}>{t("planning.text")}</Label>
            <Button variant="ghost" size="sm" onClick={() => setSource(!source)}>
              {t(source ? "planning.richText" : "planning.source")}
            </Button>
          </div>
          {source ? (
            <Textarea
              id="plan-source"
              value={draft.text}
              onChange={(event) => change({ text: event.target.value })}
              className="min-h-64 font-mono"
              disabled={mutation.isPending}
            />
          ) : (
            <Suspense fallback={<p>{t("planning.loading")}</p>}>
              <PlanningProseEditor
                value={draft.text}
                onChange={(text) => change({ text })}
                label={t("planning.text")}
                placeholder={t("planning.writePlaceholder")}
                disabled={mutation.isPending}
              />
            </Suspense>
          )}
          <p className="text-xs text-muted-foreground">{t("planning.draftHelp")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="plan-mechanics">{t("planning.mechanics")}</Label>
          <Textarea
            id="plan-mechanics"
            value={draft.mechanics}
            onChange={(event) => change({ mechanics: event.target.value })}
            placeholder={t("planning.mechanicsPlaceholder")}
            disabled={mutation.isPending}
          />
        </div>
        <details open className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {t("planning.configured")}
          </summary>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <PlanningRequirements project={project} entry={entry} entries={entries} />
            <Link className="underline" to={planningUrl(project.id, entry.target, "rows")}>
              {t("planning.editMechanics")}
            </Link>
          </div>
        </details>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap justify-between gap-2">
            <Label htmlFor="plan-image">{t("planning.imageNotes")}</Label>
            <Link
              className="text-sm underline"
              to={`/projects/${encodeURIComponent(project.id)}/editor?tab=images${resource ? `&imageId=${encodeURIComponent(resource.id)}` : ""}`}
            >
              {resource?.name || t("planning.openImages")}
            </Link>
          </div>
          <Select
            value={draft.imageStatus}
            onValueChange={(imageStatus) =>
              change({ imageStatus: imageStatus as PlanningDraft["imageStatus"] })
            }
            disabled={mutation.isPending}
          >
            <SelectTrigger aria-label={t("planning.imageStatus")} className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {["needed", "research", "ready", "none"].map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`planning.image_${value}`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t(entry.entity.image ? "planning.imageAssigned" : "planning.imageMissing")}
          </p>
          <Textarea
            id="plan-image"
            value={draft.imageNotes}
            onChange={(event) => change({ imageNotes: event.target.value })}
            placeholder={t("planning.imagePlaceholder")}
            disabled={mutation.isPending}
          />
          {urls.slice(0, 12).map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm underline"
            >
              {url}
            </a>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="plan-notes">{t("planning.notes")}</Label>
          <Textarea
            id="plan-notes"
            value={draft.notes}
            onChange={(event) => change({ notes: event.target.value })}
            placeholder={t("planning.notesPlaceholder")}
            disabled={mutation.isPending}
          />
        </div>
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">{t("planning.current")}</summary>
          <h3 className="mt-3 font-semibold">{live.title}</h3>
          <div
            className="prose prose-sm mt-2 max-w-none break-words dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(live.text) }}
          />
        </details>
        {children.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <h3 className="text-sm font-semibold">
              {t(entry.kind === "row" ? "planning.choices" : "planning.addons")}
            </h3>
            {children.length > 50 && (
              <p className="text-sm text-muted-foreground">
                {t("planning.allChildren", { count: children.length })}
              </p>
            )}
            {children.slice(0, 50).map((child) => (
              <button
                type="button"
                className="rounded border p-3 text-start hover:bg-accent"
                key={child.key}
                onClick={() => select(child.target)}
              >
                <span className="block text-sm font-medium">
                  {planningDraft(child).title || child.entity.id}
                </span>
                <span className="text-xs text-muted-foreground">
                  {child.entity.id} · {t(`planning.${planningDraft(child).status}`)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <AlertDialog
        open={resetOpen || reloadOpen}
        onOpenChange={(open) => {
          if (!open) {
            setResetOpen(false);
            setReloadOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(resetOpen ? "planning.useCurrent" : "planning.reload")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(resetOpen ? "planning.resetConfirm" : "planning.reloadConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("planning.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetOpen) void save(false, true);
                else {
                  setDraft(saved);
                  latest.current = saved;
                  setRecovered(false);
                  try {
                    localStorage.removeItem(storageKey);
                  } catch {}
                }
              }}
            >
              {t("planning.continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

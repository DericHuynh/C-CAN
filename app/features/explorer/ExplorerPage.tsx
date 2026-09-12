import { TagInput } from "@/features/tags/TagInput";
import { useSearchParams, Link } from "react-router";
import { useT } from "@agent-native/core/client/i18n";
import { NotificationsBell } from "@agent-native/core/client/notifications";
import { IconCompass, IconSearch, IconStar, IconArrowRight } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { explorerFiltersFromParams, type ExplorerFilters } from "@shared/publications";
import { usePublications } from "./use-publications";
import { useEffect, useState } from "react";

export default function ExplorerPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const filters = explorerFiltersFromParams(params);
  const [search, setSearch] = useState(filters.query);
  useEffect(() => setSearch(filters.query), [filters.query]);
  function update(patch: Partial<ExplorerFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const query = new URLSearchParams();
    if (next.query) query.set("q", next.query);
    next.tags.forEach((tag) => query.append("tag", tag));
    next.excludeTags.forEach((tag) => query.append("excludeTag", tag));
    query.set("content", next.content);
    query.set("sort", next.sort);
    if (next.page > 1) query.set("page", String(next.page));
    setParams(query);
  }
  const { data, isLoading, error, refetch } = usePublications(filters);
  return (
    <div className="mx-auto max-w-7xl space-y-7 p-4 pb-20 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-sky-400">
            <IconCompass size={18} />
            {t("publishing.discover")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("publishing.explorer")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("publishing.intro")}</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <Button variant="outline" asChild>
            <Link to="/projects">{t("publishing.myProjects")}</Link>
          </Button>
        </div>
      </header>
      <section
        className="space-y-4 rounded-xl border bg-card p-4"
        aria-label={t("publishing.filters")}
      >
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            update({ query: search });
          }}
        >
          <div className="relative flex-1">
            <IconSearch className="absolute start-3 top-3 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={160}
              className="ps-9"
              placeholder={t("publishing.searchPlaceholder")}
              aria-label={t("publishing.search")}
            />
          </div>
          <Button type="submit">{t("publishing.search")}</Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label={t("publishing.contentFilter")}
          >
            {(["sfw", "nsfw", "all"] as const).map((content) => (
              <Button
                key={content}
                size="sm"
                variant={filters.content === content ? "secondary" : "ghost"}
                aria-pressed={filters.content === content}
                onClick={() => update({ content })}
              >
                {t(`publishing.${content}`)}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            {t("publishing.sort")}
            <select
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value as ExplorerFilters["sort"] })}
              className="rounded-md border bg-background p-2"
            >
              {(["relevance", "newest", "updated", "rating"] as const).map((sort) => (
                <option key={sort} value={sort}>
                  {t(`publishing.${sort}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TagInput
            label="Include tags"
            max={12}
            value={filters.tags}
            localSuggestions={data?.tags.map((item) => item.tag)}
            onChange={(tags) =>
              update({
                tags,
                excludeTags: filters.excludeTags.filter((tag) => !tags.includes(tag)),
              })
            }
          />
          <TagInput
            label="Exclude tags"
            max={12}
            value={filters.excludeTags}
            localSuggestions={data?.tags.map((item) => item.tag)}
            onChange={(excludeTags) =>
              update({
                excludeTags,
                tags: filters.tags.filter((tag) => !excludeTags.includes(tag)),
              })
            }
          />
        </div>
        {(filters.query || filters.tags.length > 0 || filters.excludeTags.length > 0) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("");
              update({ query: "", tags: [], excludeTags: [] });
            }}
          >
            {t("publishing.clear")}
          </Button>
        )}
      </section>
      {isLoading && <p role="status">{t("publishing.loading")}</p>}
      {error && (
        <div role="alert" className="space-y-3 rounded-xl border p-8">
          <p>{t("publishing.loadFailed")}</p>
          <Button onClick={() => refetch()}>{t("publishing.retry")}</Button>
        </div>
      )}
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("publishing.results", { count: data.total })}
            </p>
            <span className="text-xs text-muted-foreground">{t("publishing.tagHint")}</span>
          </div>
          {!data.items.length ? (
            <div className="rounded-xl border border-dashed px-6 py-16 text-center">
              <IconCompass className="mx-auto mb-4 size-10 text-muted-foreground" />
              <h2 className="text-lg font-medium">{t("publishing.empty")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("publishing.emptyHint")}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) => (
                <article
                  key={item.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-sky-400/50"
                >
                  <Link
                    to={`/explorer/${item.id}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-sky-950"
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <IconCompass className="absolute inset-0 m-auto size-16 text-sky-200/25" />
                    )}
                    <span className="absolute start-3 top-3 rounded bg-black/75 px-2 py-1 text-[10px] font-semibold text-white">
                      {t(`publishing.${item.contentRating}`)}
                    </span>
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <h2 className="text-lg font-semibold">
                        <Link to={`/explorer/${item.id}`} className="hover:text-sky-400">
                          {item.title}
                        </Link>
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("publishing.by", { author: item.author })}
                      </p>
                    </div>
                    <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 5).map((tag) => (
                        <button
                          key={tag}
                          onClick={() => update({ tags: [tag] })}
                          className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                      <span className="flex items-center gap-1.5 text-sm">
                        <IconStar className="size-4 text-amber-400" />
                        {item.overall === null
                          ? t("publishing.unrated")
                          : `${item.overall.toFixed(1)} / 5`}{" "}
                        <span className="text-xs text-muted-foreground">({item.ratingCount})</span>
                      </span>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/play/${item.id}`}>
                          {t("publishing.play")}
                          <IconArrowRight className="ms-1 size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {data.pages > 1 && (
            <nav
              aria-label={t("publishing.pagination")}
              className="flex items-center justify-center gap-4"
            >
              <Button
                variant="outline"
                disabled={data.page === 1}
                onClick={() => update({ page: data.page - 1 })}
              >
                {t("publishing.previous")}
              </Button>
              <span className="text-sm">
                {data.page} / {data.pages}
              </span>
              <Button
                variant="outline"
                disabled={data.page === data.pages}
                onClick={() => update({ page: data.page + 1 })}
              >
                {t("publishing.next")}
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

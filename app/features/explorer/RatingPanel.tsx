import { useState } from "react";
import { useSession } from "@agent-native/core/client/hooks";
import { buildSignInReturnHref } from "@agent-native/core/client/ui";
import { useT } from "@agent-native/core/client/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RATING_CATEGORIES, type RatingBallot } from "@shared/publications";
import { usePublication, useRatePublication } from "./use-publications";

type Publication = NonNullable<ReturnType<typeof usePublication>["data"]>;
export function RatingPanel({
  publication,
  onSaved,
}: {
  publication: Publication;
  onSaved: () => unknown;
}) {
  const t = useT();
  const { session } = useSession();
  return (
    <section className="space-y-5 rounded-xl border bg-card p-5" aria-labelledby="ratings-title">
      <div>
        <h2 id="ratings-title" className="text-xl font-semibold">
          {t("publishing.ratings")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("publishing.ratingHint")}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {RATING_CATEGORIES.map((category) => {
          const summary = publication.ratings[category];
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{t(`publishing.${category}`)}</h3>
                <span className="text-sm">
                  {summary.average === null ? "—" : `${summary.average.toFixed(1)} / 5`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("publishing.votes", { count: summary.count })}
              </p>
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1, 0].map((value) => (
                  <div
                    key={value}
                    className="flex items-center gap-2 text-xs"
                    aria-label={t("publishing.ratingBin", {
                      score: value,
                      count: summary.distribution[value],
                    })}
                  >
                    <span className="w-2">{value}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded bg-amber-400"
                        style={{
                          width: `${summary.count ? (summary.distribution[value] / summary.count) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-5 text-end text-muted-foreground">
                      {summary.distribution[value]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t pt-5">
        {!session ? (
          <Button variant="outline" asChild>
            <a href={buildSignInReturnHref()}>{t("publishing.signInRate")}</a>
          </Button>
        ) : !publication.canRate ? (
          <p className="text-sm text-muted-foreground">{t("publishing.authorRating")}</p>
        ) : (
          <BallotForm
            key={`${publication.id}:${session.email}:${JSON.stringify(publication.myRating)}`}
            publication={publication}
            onSaved={onSaved}
          />
        )}
      </div>
    </section>
  );
}
function BallotForm({
  publication,
  onSaved,
}: {
  publication: Publication;
  onSaved: () => unknown;
}) {
  const t = useT();
  const rate = useRatePublication();
  const [ballot, setBallot] = useState<Record<keyof RatingBallot, number | null>>(
    publication.myRating ?? { overall: null, writing: null, gameplay: null, presentation: null },
  );
  const [error, setError] = useState("");
  async function save(remove = false) {
    setError("");
    try {
      await rate.mutateAsync({
        id: publication.id,
        ballot: remove ? null : (ballot as RatingBallot),
      });
      toast.success(t(remove ? "publishing.ratingRemoved" : "publishing.ratingSaved"));
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("publishing.saveFailed"));
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-4"
    >
      <h3 className="font-medium">{t("publishing.yourRating")}</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {RATING_CATEGORIES.map((category) => (
          <fieldset key={category} className="min-w-0 space-y-2">
            <legend className="text-sm">
              {t(`publishing.${category}`)}
              {category !== "overall" && (
                <span className="ms-1 text-xs text-muted-foreground">
                  {t("publishing.optional")}
                </span>
              )}
            </legend>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="relative flex-1 cursor-pointer">
                  <input
                    disabled={rate.isPending}
                    type="radio"
                    className="peer sr-only"
                    name={`rating-${category}`}
                    value={value}
                    checked={ballot[category] === value}
                    required={category === "overall"}
                    onChange={() => setBallot({ ...ballot, [category]: value })}
                  />
                  <span className="flex h-9 items-center justify-center rounded border text-sm peer-checked:border-amber-400 peer-checked:bg-amber-400/15 peer-checked:text-amber-400 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                    {value}
                  </span>
                </label>
              ))}
            </div>
            {category !== "overall" && (
              <button
                disabled={rate.isPending}
                type="button"
                onClick={() => setBallot({ ...ballot, [category]: null })}
                className="text-xs text-muted-foreground underline"
              >
                {t("publishing.skipCategory")}
              </button>
            )}
          </fieldset>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={rate.isPending || ballot.overall === null} type="submit">
          {rate.isPending ? t("publishing.saving") : t("publishing.saveRating")}
        </Button>
        {publication.myRating && (
          <Button
            type="button"
            variant="ghost"
            disabled={rate.isPending}
            onClick={() => save(true)}
          >
            {t("publishing.removeRating")}
          </Button>
        )}
      </div>
    </form>
  );
}

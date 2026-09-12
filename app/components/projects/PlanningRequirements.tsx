import { useMemo } from "react";
import { Link } from "react-router";
import { useT } from "@agent-native/core/client/i18n";
import type { Requireds } from "@shared/types";
import { planningUrl, type PlanningEntry } from "@shared/planning";
import type { ProjectDetail } from "@/hooks/use-projects";

/** Show real wiring alongside the prose without pretending that planning notes are rules. */
export function PlanningRequirements({
  project,
  entry,
  entries,
}: {
  project: ProjectDetail;
  entry: PlanningEntry;
  entries: PlanningEntry[];
}) {
  const t = useT();
  const refs = useMemo(() => new Map(entries.map((item) => [item.entity.id, item])), [entries]);
  const requirements = entry.entity.requireds ?? [];
  function describe(req: Requireds, depth = 0): React.ReactNode {
    if (depth > 8) return t("planning.complexRule");
    if (req.type === "id") {
      const target = refs.get(req.reqId);
      return (
        <>
          {t(req.required ? "planning.selected" : "planning.notSelected")}{" "}
          {target ? (
            <Link className="underline" to={planningUrl(project.id, target.target)}>
              {target.entity.title || req.reqId} ({req.reqId})
            </Link>
          ) : (
            <span>{req.reqId || t("planning.missingReference")}</span>
          )}
        </>
      );
    }
    if (req.type === "points" && req.required) {
      const point = project.app.pointTypes.find((point) => point.id === req.reqId);
      const operator =
        ({ "1": ">", "2": "≥", "3": "=", "4": "≤", "5": "<", "6": "≠" } as Record<string, string>)[
          req.operator ?? "1"
        ] ?? "?";
      return (
        <>
          {point?.name || req.reqId} {operator} {req.reqPoints}
        </>
      );
    }
    if (req.type === "or" && req.required)
      return (
        <>
          {t("planning.anyRequired", { count: req.orNum ?? 1 })}
          <ul className="ms-4 list-disc">
            {(req.orRequireds ?? []).map((child, i) => (
              <li key={i}>{describe(child, depth + 1)}</li>
            ))}
          </ul>
        </>
      );
    if (req.type === "gid")
      return (
        <>
          {t(req.required ? "planning.globalMet" : "planning.globalNotMet")}{" "}
          {(project.app.globalRequirements ?? []).find((item) => item.id === req.reqId)?.name ||
            req.reqId}{" "}
          <Link
            className="underline"
            to={`/projects/${encodeURIComponent(project.id)}/editor?tab=requirements`}
          >
            {t("planning.openRequirements")}
          </Link>
        </>
      );
    return (
      <>
        {t("planning.complexRule")} ({req.type})
      </>
    );
  }
  return (
    <div className="flex flex-col gap-2 text-sm">
      {requirements.length ? (
        <>
          <p className="text-muted-foreground">{t("planning.allRequired")}</p>
          <ul className="ms-4 list-disc">
            {requirements.map((req, i) => (
              <li key={i}>{describe(req)}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground">{t("planning.requirementsEmpty")}</p>
      )}
      {(entry.entity.scores ?? []).map((score: { id: string; value: number }, i: number) => (
        <p key={i}>
          {project.app.pointTypes.find((point) => point.id === score.id)?.name ?? score.id}:{" "}
          {t(Number(score.value) >= 0 ? "planning.cost" : "planning.gain", {
            value: Math.abs(Number(score.value)),
          })}
        </p>
      ))}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          {t("planning.ruleDetails")}
        </summary>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
          {JSON.stringify(requirements, null, 2)}
        </pre>
      </details>
    </div>
  );
}

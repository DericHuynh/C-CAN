import { useEffect, useRef, useState } from "react";
import { callAction } from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import type { ProjectDetail } from "@shared/project-contracts";
import { sameValue } from "@shared/collaboration-merge";
import { readLivePath, writeLivePath } from "@shared/live-project-path";
import type { LiveFields } from "./live-fields";

/** Coalesce typing; serialize saves while Yjs continues streaming immediately. */
export function useLiveAutosave(store: LiveFields | null, project: ProjectDetail, version: number) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const running = useRef(false);
  const needsRefresh = useRef(false);
  const failedFields = useRef<string | null>(null);
  const latest = useRef({ store, project });
  latest.current = { store, project };
  const firstPendingAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void flushRef.current();
    };
  }, []);
  const flush = async () => {
    if (running.current) return;
    const { store, project: renderedProject } = latest.current;
    const project =
      queryClient.getQueryData<ProjectDetail>([
        "action",
        "get-project",
        { id: renderedProject.id },
      ]) ?? renderedProject;
    const fields = store?.pending(project.app, project) ?? [];
    if (!fields.length) return;
    running.current = true;
    firstPendingAt.current = null;
    if (mounted.current) setStatus("saving");
    let committed = false;
    try {
      const result = await callAction("save-live-project-fields", {
        projectId: project.id,
        fields,
      });
      const key = ["action", "get-project", { id: project.id }];
      await queryClient.cancelQueries({ queryKey: key });
      const current = queryClient.getQueryData<ProjectDetail>(key);
      if (current) {
        let next = current;
        for (const field of result.fields) {
          const submitted = fields.find((item) => sameValue(item.path, field.path));
          const currentValue =
            field.path[0] === "$metadata"
              ? current[field.path[1] as "title" | "description"]
              : readLivePath(current.app, field.path);
          if (
            !submitted ||
            (!sameValue(currentValue, submitted.base) && !sameValue(currentValue, field.value))
          )
            continue;
          next =
            field.path[0] === "$metadata"
              ? { ...next, [field.path[1]]: field.value }
              : { ...next, app: writeLivePath(next.app, field.path, field.value) };
        }
        store?.acknowledge(current.app, next.app);
        store?.acknowledge({ $metadata: current }, { $metadata: next });
        queryClient.setQueryData(key, next);
      }
      committed = true;
      needsRefresh.current = true;
      if (mounted.current) setStatus("idle");
      // The compact response is enough locally. Other tabs receive Core's
      // resource-scoped save event; avoid a full project fetch per keystroke.
    } catch {
      failedFields.current = JSON.stringify(fields);
      if (mounted.current) setStatus("error");
      // Re-read a concurrent edit without retrying against an invented baseline.
      void queryClient.invalidateQueries({
        queryKey: ["action", "get-project", { id: project.id }],
      });
    } finally {
      running.current = false;
      if (committed && !mounted.current)
        queueMicrotask(() => {
          void flushRef.current();
        });
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const pending = store?.pending(project.app, project) ?? [];
    if (status === "error") {
      if (pending.length && JSON.stringify(pending) !== failedFields.current) setStatus("idle");
      return;
    }
    if (!pending.length) {
      if (!needsRefresh.current) return;
      const quiet = setTimeout(() => {
        needsRefresh.current = false;
        void queryClient.invalidateQueries({
          queryKey: ["action", "get-project", { id: project.id }],
        });
        void queryClient.invalidateQueries({ queryKey: ["action", "list-projects"] });
      }, 1200);
      return () => clearTimeout(quiet);
    }
    firstPendingAt.current ??= Date.now();
    timer.current = setTimeout(
      () => {
        void flushRef.current();
      },
      Math.min(300, Math.max(0, 1000 - (Date.now() - firstPendingAt.current!))),
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [store, project, version, status]);
  return {
    status,
    retry: () => {
      setStatus("idle");
      void flushRef.current();
    },
  };
}

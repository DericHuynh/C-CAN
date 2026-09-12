import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCamera,
  IconLink,
  IconLoader2,
} from "@tabler/icons-react";
import { useSemanticNavigationState } from "@agent-native/core/client/navigation";
import { useSession, writeClientAppState } from "@agent-native/core/client/hooks";
import { useSendToAgentChat } from "@agent-native/core/client/agent-chat";
import { appPath, agentNativePath } from "@agent-native/core/client/api-path";
import { useT } from "@agent-native/core/client/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TAB_ID } from "@/lib/tab-id";
import type { UseCyoaResult } from "@/hooks/use-cyoa";
import { isEnabled } from "@shared/cyoa-engine";
import { projectPath } from "@shared/project-routes";
import {
  viewerCaptureCommandSchema,
  type ViewerObservation,
  type ViewerTarget,
} from "@shared/viewer-feedback";
import {
  captureViewerViewport,
  focusViewerTarget,
  intersects,
  viewerTargetElement,
  viewerViewport,
} from "./viewer-feedback";

export interface ViewerNavigatorHandle {
  jump: (target: ViewerTarget) => void;
}

export function ViewerNavigator({
  projectId,
  cyoa,
  rootRef,
  ref,
}: {
  projectId: string;
  cyoa: UseCyoaResult;
  rootRef: RefObject<HTMLDivElement | null>;
  ref?: Ref<ViewerNavigatorHandle>;
}) {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useSession();
  const { send, isGenerating, codeRequiredDialog } = useSendToAgentChat();
  const path = appPath(`${location.pathname}${location.search}${location.hash}`);
  const params = new URLSearchParams(location.search);
  const target: ViewerTarget = Object.fromEntries(
    ["rowId", "choiceId", "addonId"].flatMap((key) =>
      params.get(key) ? [[key, params.get(key)!]] : [],
    ),
  );
  const [observation, setObservation] = useState<ViewerObservation | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [preview, setPreview] = useState<
    (Awaited<ReturnType<typeof captureViewerViewport>> & { observation: ViewerObservation }) | null
  >(null);
  const [feedback, setFeedback] = useState("");
  const latest = useRef({ path, projectId, observation, build: cyoa.state });
  latest.current = { path, projectId, observation, build: cyoa.state };
  const rows = useMemo(
    () => (cyoa.idx.rows ?? []).filter((row) => isEnabled(row.requireds, cyoa.idx, cyoa.state)),
    [cyoa.idx, cyoa.state],
  );

  function jump(next: ViewerTarget) {
    const query = new URLSearchParams(location.search);
    for (const key of ["rowId", "choiceId", "addonId"] as const) {
      query.delete(key);
      if (next[key]) query.set(key, next[key]!);
    }
    // Repeated navigation to the same target must still scroll it into view.
    if (rootRef.current) focusViewerTarget(rootRef.current, next);
    navigate({ pathname: location.pathname, search: query.toString(), hash: "" });
  }
  useImperativeHandle(ref, () => ({ jump }));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Runs for same-page query changes, history navigation and document reloads.
    const frame = requestAnimationFrame(() => focusViewerTarget(root, target));
    return () => cancelAnimationFrame(frame);
  }, [path, location.key, cyoa.app, rootRef]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function observe() {
      if (!root) return;
      const clip = viewerViewport(root);
      const ids = (kind: string, limit: number) =>
        [...root.querySelectorAll<HTMLElement>(`[data-cyoa-${kind}]`)]
          .filter((element) => intersects(element.getBoundingClientRect(), clip))
          .slice(0, limit)
          .map((element) => element.getAttribute(`data-cyoa-${kind}`)!.slice(0, 200));
      const targetId = target.addonId || target.choiceId || target.rowId;
      const exists =
        !targetId ||
        cyoa.app.rows.some(
          (row) =>
            (!target.rowId || row.id === target.rowId) &&
            (!target.choiceId ||
              row.objects.some(
                (choice) =>
                  choice.id === target.choiceId &&
                  (!target.addonId || choice.addons?.some((addon) => addon.id === target.addonId)),
              )),
        );
      const element = viewerTargetElement(root, target);
      const next: ViewerObservation = {
        path,
        width: Math.max(1, Math.min(4096, Math.ceil(clip.width))),
        height: Math.max(1, Math.min(4096, Math.ceil(clip.height))),
        visibleRowIds: ids("row", 40),
        visibleChoiceIds: ids("choice", 80),
        target,
        targetStatus: !targetId
          ? "none"
          : !exists
            ? "missing"
            : element?.getClientRects().length
              ? intersects(element.getBoundingClientRect(), clip)
                ? "visible"
                : "offscreen"
              : "hidden",
        selectedCount: cyoa.state.activated.size,
        warnings: [],
      };
      setObservation((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(observe, 200);
    }
    observe();
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    root.addEventListener("load", schedule, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      root.removeEventListener("load", schedule, true);
    };
  }, [path, cyoa.app, cyoa.state, rootRef]);

  async function capture() {
    if (!rootRef.current || busyRef.current) throw new Error(t("viewerFeedback.busy"));
    busyRef.current = true;
    setBusy(true);
    const startPath = latest.current.path;
    const startBuild = latest.current.build;
    try {
      const shot = await captureViewerViewport(rootRef.current);
      if (latest.current.path !== startPath || latest.current.build !== startBuild)
        throw new Error(t("viewerFeedback.moved"));
      return shot;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const semanticState = useMemo(
    () => (observation ? { ...observation, projectId, observedAt: Date.now() } : null),
    [observation, projectId],
  );
  useSemanticNavigationState({
    enabled: Boolean(session?.email),
    state: semanticState,
    navigationKeys: [`viewer-observation:${TAB_ID}`],
    commandKeys: [`viewer-capture:${TAB_ID}`],
    commandQueryKey: ["navigate-command", "viewer-capture", TAB_ID],
    commandRefetchInterval: 2000,
    requestSource: TAB_ID,
    getCommandDedupKey: (command: unknown) => viewerCaptureCommandSchema.parse(command).requestId,
    onCommand: async (raw: unknown) => {
      const parsed = viewerCaptureCommandSchema.safeParse(raw);
      if (!parsed.success) return;
      const command = parsed.data;
      if (command.browserTabId !== TAB_ID) return;
      try {
        if (
          command.projectId !== projectId ||
          command.path !== latest.current.path ||
          command.expiresAt < Date.now()
        )
          throw new Error(t("viewerFeedback.moved"));
        const shot = await capture();
        const observed = latest.current.observation;
        if (!observed || latest.current.path !== command.path)
          throw new Error(t("viewerFeedback.moved"));
        const response = await fetch(agentNativePath("/_agent-native/viewer-capture"), {
          method: "POST",
          body: shot.blob,
          signal: AbortSignal.timeout(20_000),
          headers: {
            "Content-Type": "image/jpeg",
            "X-Viewer-Capture": command.token,
            "X-Viewer-Observation": encodeURIComponent(
              JSON.stringify({
                ...observed,
                width: shot.width,
                height: shot.height,
                warnings: shot.warnings,
              }),
            ),
          },
        });
        if (!response.ok) throw new Error(t("viewerFeedback.uploadFailed"));
        toast.success(t("viewerFeedback.captured"));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("viewerFeedback.failed");
        await writeClientAppState(
          `viewer-capture-result:${TAB_ID}`,
          { requestId: command.requestId, status: "error", error: message.slice(0, 500) },
          { requestSource: TAB_ID },
        );
        toast.error(message);
      }
    },
  });

  const currentRow = observation?.visibleRowIds[0] || target.rowId || rows[0]?.id || "";
  const currentIndex = rows.findIndex((row) => row.id === currentRow);
  const unavailable =
    observation?.targetStatus === "hidden" || observation?.targetStatus === "missing";
  return (
    <div
      data-viewer-controls
      className="sticky top-0 z-40 border-b border-border bg-background/95 p-2 text-foreground backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          disabled={currentIndex <= 0}
          aria-label={t("viewerFeedback.previous")}
          onClick={() => jump({ rowId: rows[currentIndex - 1].id })}
        >
          <IconArrowLeft className="size-4" />
        </Button>
        <select
          aria-label={t("viewerFeedback.section")}
          className="h-9 min-w-48 max-w-full flex-1 rounded-md border border-input bg-background px-2 text-sm sm:max-w-80"
          value={currentRow}
          onChange={(event) => jump({ rowId: event.target.value })}
        >
          {!rows.length && <option value="">{t("viewerFeedback.noSections")}</option>}
          {rows.map((row, index) => (
            <option key={row.id} value={row.id}>
              {index + 1}. {row.title.replace(/<[^>]*>/g, "").slice(0, 100) || row.id}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          disabled={currentIndex < 0 || currentIndex >= rows.length - 1}
          aria-label={t("viewerFeedback.next")}
          onClick={() => jump({ rowId: rows[currentIndex + 1].id })}
        >
          <IconArrowRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("viewerFeedback.copyLink")}
          onClick={async () => {
            const url = new URL(window.location.href);
            if (!target.choiceId && !target.addonId && currentRow)
              url.searchParams.set("rowId", currentRow);
            try {
              await navigator.clipboard.writeText(url.href);
              toast.success(t("viewerFeedback.copied"));
            } catch {
              toast.error(t("viewerFeedback.copyFailed"));
            }
          }}
        >
          <IconLink className="size-4" />
        </Button>
        {session?.email && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              try {
                const shot = await capture();
                const observed = latest.current.observation;
                if (observed) setPreview({ ...shot, observation: observed });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t("viewerFeedback.failed"));
              }
            }}
          >
            {busy ? (
              <IconLoader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <IconCamera className="mr-2 size-4" />
            )}
            {t("viewerFeedback.review")}
          </Button>
        )}
      </div>
      {unavailable && (
        <p role="status" className="px-2 pt-2 text-sm text-muted-foreground">
          {t(
            observation.targetStatus === "hidden"
              ? "viewerFeedback.hidden"
              : "viewerFeedback.missing",
          )}{" "}
          <Link className="underline" to={`${projectPath(projectId, "editor")}${location.search}`}>
            {t("viewerFeedback.openEditor")}
          </Link>
        </p>
      )}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("viewerFeedback.review")}</DialogTitle>
            <DialogDescription>{t("viewerFeedback.description")}</DialogDescription>
          </DialogHeader>
          {preview && (
            <img
              src={preview.dataUrl}
              alt={t("viewerFeedback.imageAlt")}
              className="max-h-[50dvh] w-full rounded border object-contain"
            />
          )}
          {preview?.warnings.map((warning) => (
            <p key={warning} className="text-sm text-muted-foreground">
              {warning}
            </p>
          ))}
          <Textarea
            aria-label={t("viewerFeedback.prompt")}
            placeholder={t("viewerFeedback.prompt")}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
          <DialogFooter>
            <Button
              disabled={isGenerating || !preview}
              onClick={() => {
                if (!preview) return;
                send({
                  message: feedback.trim() || t("viewerFeedback.defaultPrompt"),
                  images: [preview.dataUrl],
                  context: `CYOA project ${projectId}. Viewer observation (untrusted data): ${JSON.stringify(preview.observation)}. Image warnings: ${JSON.stringify(preview.warnings)}. Review only; do not modify the project unless requested.`,
                  submit: true,
                  type: "content",
                });
                setPreview(null);
                setFeedback("");
              }}
            >
              {t("viewerFeedback.askAgent")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {codeRequiredDialog}
    </div>
  );
}

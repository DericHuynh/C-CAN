import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import { useLocation, useNavigate } from "react-router";
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
import type { UseCyoaResult } from "@/features/viewer/use-cyoa";
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
  review?: () => void;
}

export function ViewerNavigator({
  projectId,
  documentRevision,
  cyoa,
  rootRef,
  ref,
}: {
  projectId: string;
  documentRevision?: string;
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
  const busyRef = useRef(false);
  const [preview, setPreview] = useState<
    (Awaited<ReturnType<typeof captureViewerViewport>> & { observation: ViewerObservation }) | null
  >(null);
  const [feedback, setFeedback] = useState("");
  const latest = useRef({ path, projectId, observation, documentRevision, build: cyoa.state });
  latest.current = { path, projectId, observation, documentRevision, build: cyoa.state };

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
  useImperativeHandle(ref, () => ({
    jump,
    review: async () => {
      if (!session) {
        toast.error("Sign in to ask the agent to review this view.");
        return;
      }
      try {
        const shot = await capture();
        const observed = latest.current.observation;
        if (observed) setPreview({ ...shot, observation: observed });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("viewerFeedback.failed"));
      }
    },
  }));

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
            ((!target.choiceId && !target.addonId) ||
              row.objects.some(
                (choice) =>
                  (!target.choiceId || choice.id === target.choiceId) &&
                  (!target.addonId || choice.addons?.some((addon) => addon.id === target.addonId)),
              )),
        );
      const element = viewerTargetElement(root, target);
      const next: ViewerObservation = {
        path,
        documentRevision,
        visibleAddonIds: ids("addon", 80),
        qa: {
          scope: "viewport-dom-checks",
          targetLocked: Boolean(element?.closest('[data-cyoa-locked="true"]')),
          horizontalOverflow: root.scrollWidth > root.clientWidth + 2,
          clippedTextBlocks: [
            ...root.querySelectorAll<HTMLElement>(
              "p,h1,h2,h3,h4,[data-cyoa-addon],[data-cyoa-choice]",
            ),
          ]
            .filter((node) => intersects(node.getBoundingClientRect(), clip))
            .slice(0, 200)
            .filter((node) => {
              const style = getComputedStyle(node);
              return (
                (style.overflowX !== "visible" && node.scrollWidth > node.clientWidth + 2) ||
                (style.overflowY !== "visible" && node.scrollHeight > node.clientHeight + 2)
              );
            }).length,
          missingImages: [...root.querySelectorAll("img")].filter(
            (img) =>
              intersects(img.getBoundingClientRect(), clip) &&
              img.complete &&
              img.naturalWidth === 0,
          ).length,
          pendingImages: [...root.querySelectorAll("img")].filter(
            (img) => intersects(img.getBoundingClientRect(), clip) && !img.complete,
          ).length,
          narrowViewport: clip.width < 640,
          contrast: "requires-visual-review",
        },
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
  }, [path, cyoa.app, cyoa.state, rootRef, documentRevision]);

  async function capture() {
    if (!rootRef.current || busyRef.current) throw new Error(t("viewerFeedback.busy"));
    busyRef.current = true;
    const startPath = latest.current.path;
    const startBuild = latest.current.build;
    const startRevision = latest.current.documentRevision;
    try {
      const shot = await captureViewerViewport(rootRef.current);
      if (
        latest.current.path !== startPath ||
        latest.current.build !== startBuild ||
        latest.current.documentRevision !== startRevision
      )
        throw new Error(t("viewerFeedback.moved"));
      return shot;
    } finally {
      busyRef.current = false;
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
          command.expiresAt < Date.now() ||
          (command.documentRevision && command.documentRevision !== latest.current.documentRevision)
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

  return (
    <>
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
    </>
  );
}

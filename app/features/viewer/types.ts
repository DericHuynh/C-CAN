import type { App, Row } from "@shared/types";

export interface CyoaViewerProps {
  app: App;
  projectId?: string;
  documentRevision?: string;
  previewBuildCode?: string;
  /** Public release: headless deep-link handling without private editor/capture APIs. */
  published?: boolean;
  /** Supplied while the standalone player is fullscreen. */
  onExitFullscreen?: () => void;
  className?: string;
  /**
   * Visual-editor mode adds edit buttons and double-click inline editing while
   * normal choice clicks retain gameplay interactions. The preview stays
   * fully rendered so edits can be reviewed live in the V-Editor's canvas.
   */
  editing?: boolean;
  /** Currently selected entity in the visual editor. */
  selection?: VisualSelection | null;
  /** Called when a row/choice is clicked in the visual editor. */
  onSelect?: (selection: VisualSelection) => void;
  /** Called when a toolbar action fires on the selected entity. */
  onAction?: (action: VisualEditAction, selection: VisualSelection) => void;
  /** Row/choice text field being edited inline (Figma-style double-click). */
  editTarget?: VisualEditTarget | null;
  /** Double-clicked a title/description on the canvas to edit it in place. */
  onStartEdit?: (target: VisualEditTarget) => void;
  /** The inline editor committed a new value for the field. */
  onCommitEdit?: (target: VisualEditTarget, value: string) => void;
  /**
   * Right-click in V-Editor mode: selection is the row/choice under the cursor
   * (or null for the empty canvas). The browser menu is already prevented.
   */
  onContextMenu?: (selection: VisualSelection | null, event: React.MouseEvent) => void;
}

/** Toolbar actions the V-Editor canvas can trigger on a row/choice. */
export type VisualEditAction = "edit" | "add-choice" | "move-up" | "move-down" | "delete";

/** A row or choice selected in the V-Editor canvas. */
export interface VisualSelection {
  kind: "row" | "choice";
  id: string;
}

/**
 * A text field being edited inline on the canvas. Row fields are `title` and
 * `titleText`; choice fields are `title` and `text`.
 */
export interface VisualEditTarget {
  kind: "row" | "choice";
  id: string;
  field: "title" | "titleText" | "text";
}

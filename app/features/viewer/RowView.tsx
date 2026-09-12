import { rowJustifyClass } from "./layout";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import { cn } from "@/lib/utils";
import {
  groupRowChoices,
  hiddenContentsFor,
  isEnabled,
  isRowButtonDisabled,
  resultRowChoices,
} from "@shared/cyoa-engine";
import type { Choice, Row } from "@shared/types";
import { getStyling } from "@shared/cyoa-styling";
import { resolveImageRef } from "@shared/cyoa";
import {
  choiceMargin,
  imageStyle,
  numValue,
  renderHtml,
  rowButtonStyle,
  rowSurfaceStyle,
  textStyle,
  viewerTemplate,
} from "./cyoa-styles";
import { ViewerImage } from "./ViewerImage";
import { InlineTextEditor } from "@/components/editor/InlineTextEditor";
import { sortedChoices } from "@shared/project-selectors";
import { effectiveChoiceWidth } from "./layout";
import type { VisualEditAction } from "./types";
import type { VisualSelection } from "./types";
import type { VisualEditTarget } from "./types";
import { EditToolbar } from "./EditToolbar";
import { ChoiceView } from "./ChoiceView";

interface RowViewProps {
  cyoa: UseCyoaResult;
  row: Row;
  viewport: number;
  editing?: boolean;
  selection?: VisualSelection | null;
  onSelect?: (selection: VisualSelection) => void;
  onAction?: (action: VisualEditAction, selection: VisualSelection) => void;
  editTarget?: VisualEditTarget | null;
  onStartEdit?: (target: VisualEditTarget) => void;
  onCommitEdit?: (target: VisualEditTarget, value: string) => void;
  onContextMenu?: (selection: VisualSelection | null, event: React.MouseEvent) => void;
}

export function RowView({
  cyoa,
  row,
  viewport,
  editing = false,
  selection = null,
  onSelect,
  onAction,
  editTarget = null,
  onStartEdit,
  onCommitEdit,
  onContextMenu,
}: RowViewProps) {
  const enabled = isEnabled(row.requireds, cyoa.idx, cyoa.state);

  // Hidden entirely when requirements are unmet (original behavior).
  if (!enabled) {
    // `deselectChoices` auto-deselects the row's choices when unmet.
    return null;
  }

  const isSelected = editing && selection?.kind === "row" && selection.id === row.id;
  // Document-order position for the move-up/down toolbar affordances.
  const allRows = cyoa.idx.rows ?? [];
  const rowIndex = allRows.findIndex((r) => r.id === row.id);

  // Figma-style inline editing: the target field renders as a live editor.
  const isEditingTitle =
    editing &&
    editTarget?.kind === "row" &&
    editTarget.id === row.id &&
    editTarget.field === "title";
  const isEditingText =
    editing &&
    editTarget?.kind === "row" &&
    editTarget.id === row.id &&
    editTarget.field === "titleText";
  const startEdit =
    (field: "title" | "titleText") =>
    (event: React.MouseEvent): void => {
      if (!editing) return;
      event.stopPropagation();
      onSelect?.({ kind: "row", id: row.id });
      onStartEdit?.({ kind: "row", id: row.id, field });
    };
  const handleContextMenu = (event: React.MouseEvent): void => {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.({ kind: "row", id: row.id });
    onContextMenu?.({ kind: "row", id: row.id }, event);
  };

  const titleStyle = textStyle("rowTitle", cyoa.idx, cyoa.state, row);
  const textStyleObj = textStyle("rowText", cyoa.idx, cyoa.state, row);
  const hidden = hiddenContentsFor(row, cyoa.idx, cyoa.state);
  const rowTextRemoved = hidden.size > 0;
  const tpl = viewerTemplate(row, true, cyoa.app, viewport, cyoa.idx, cyoa.state);
  const rowImageStyle = imageStyle("rowImage", cyoa.idx, cyoa.state, row);
  const rowSurface = rowSurfaceStyle(row, cyoa.idx, cyoa.state);
  // The row body (section) carries the row-body margins plus the private /
  // design-group body background (original `AppRow.rowBody`); the header box
  // below holds the header background/border/shadow (`rowBackground`).
  const sectionStyle: React.CSSProperties = {
    margin: rowSurface.margin,
    ...(rowSurface.bodyBackgroundImage
      ? {
          backgroundImage: `url(${rowSurface.bodyBackgroundImage})`,
          backgroundRepeat: rowSurface.bodyBackgroundRepeat || undefined,
          backgroundSize: rowSurface.bodyBackgroundSize || undefined,
        }
      : {}),
    ...(rowSurface.bodyBackgroundColor ? { backgroundColor: rowSurface.bodyBackgroundColor } : {}),
  };

  // Row card surface (original `AppRow.rowBackground`): the header box that
  // wraps the image/button, title and text carries the row's background,
  // border, radius, shadow and `rowMargin` side insets; the outer section
  // holds only the `rowBody` margins (top / sides% / bottom).
  const headerStyle = {
    backgroundColor: rowSurface.backgroundColor || undefined,
    backgroundImage: rowSurface.gradient
      ? rowSurface.gradient
      : rowSurface.backgroundImage
        ? `url(${rowSurface.backgroundImage})`
        : undefined,
    backgroundRepeat: rowSurface.backgroundRepeat || undefined,
    backgroundSize: rowSurface.backgroundSize || undefined,
    border: rowSurface.borderColor
      ? `${rowSurface.borderWidth} ${rowSurface.borderStyle} ${rowSurface.borderColor}`
      : undefined,
    borderRadius: rowSurface.borderRadius || undefined,
    overflow: rowSurface.overflow || undefined,
    boxShadow: rowSurface.boxShadow || undefined,
    filter: rowSurface.filter || undefined,
    marginBottom: rowSurface.marginBottom || undefined,
    marginLeft: rowSurface.marginLeft || undefined,
    marginRight: rowSurface.marginRight || undefined,
    ...(rowSurface.borderImage ? { borderImage: rowSurface.borderImage } : {}),
  } as React.CSSProperties;

  const titleEl =
    row.title || isEditingTitle ? (
      isEditingTitle ? (
        <InlineTextEditor
          key={`row-title:${row.id}`}
          livePath={["rows", row.id, "title"]}
          sourceText={row.title ?? ""}
          as="h2"
          html={renderHtml(row.title ?? "", cyoa.idx, cyoa.state).__html}
          style={titleStyle}
          className="font-semibold"
          onCommit={(value) => onCommitEdit?.({ kind: "row", id: row.id, field: "title" }, value)}
        />
      ) : (
        <h2
          className="font-semibold"
          style={titleStyle}
          onDoubleClick={startEdit("title")}
          dangerouslySetInnerHTML={renderHtml(row.title, cyoa.idx, cyoa.state)}
        />
      )
    ) : null;
  const textEl = isEditingText ? (
    <InlineTextEditor
      key={`row-text:${row.id}`}
      livePath={["rows", row.id, "titleText"]}
      sourceText={row.titleText ?? ""}
      as="p"
      html={renderHtml(row.titleText ?? "", cyoa.idx, cyoa.state).__html}
      style={textStyleObj}
      className="leading-6"
      onCommit={(value) => onCommitEdit?.({ kind: "row", id: row.id, field: "titleText" }, value)}
    />
  ) : row.titleText && !rowTextRemoved ? (
    <p
      className="leading-6"
      style={textStyleObj}
      onDoubleClick={startEdit("titleText")}
      dangerouslySetInnerHTML={renderHtml(row.titleText, cyoa.idx, cyoa.state)}
    />
  ) : null;
  // Row buttons render in the image slot (original `isButtonRow` replaces the
  // row image); otherwise the row image spans the full width at its natural
  // height, only constrained when the document opts into a fixed object-fit.
  const imageEl = row.isButtonRow ? (
    <RowButton cyoa={cyoa} row={row} />
  ) : row.image ? (
    <ViewerImage
      src={resolveImageRef(cyoa.app, row.image)}
      title={row.imageSourceTooltip || undefined}
      alt=""
      className="w-full"
      style={rowImageStyle}
    />
  ) : null;

  const rowToolbar = editing ? (
    <EditToolbar
      kind="row"
      selection={{ kind: "row", id: row.id }}
      canMoveUp={rowIndex > 0}
      canMoveDown={rowIndex >= 0 && rowIndex < allRows.length - 1}
      onAction={onAction}
    />
  ) : null;

  if (imageEl || titleEl || textEl) {
    if (tpl === 2 || tpl === 3) {
      // Side-by-side row templates: 2 = image right, 3 = image left.
      const styling = getStyling("privateRowImageIsOn", cyoa.idx, cyoa.state, row) as Record<
        string,
        unknown
      >;
      const imageBox = numValue(styling.rowImageBoxWidth, 50);
      const textBox = 100 - imageBox;
      const imageCol = (
        <div className="min-w-0" style={{ width: `${imageBox}%` }}>
          {imageEl}
        </div>
      );
      const textCol = (
        <div className="min-w-0" style={{ width: `${textBox}%` }}>
          {titleEl}
          {textEl}
        </div>
      );
      return (
        <section
          className={cn(editing && "relative pt-9")}
          style={sectionStyle}
          onContextMenu={editing ? handleContextMenu : undefined}
        >
          <header
            className={cn(
              "flex items-start",
              editing && "cursor-pointer",
              isSelected && "outline-2 outline-primary outline",
            )}
            style={headerStyle}
          >
            {tpl === 2 ? (
              <>
                {textCol}
                {imageCol}
              </>
            ) : (
              <>
                {imageCol}
                {textCol}
              </>
            )}
          </header>
          {rowToolbar}
          {rowContent(
            cyoa,
            row,
            viewport,
            editing,
            selection,
            onSelect,
            onAction,
            editTarget,
            onStartEdit,
            onCommitEdit,
            onContextMenu,
          )}
        </section>
      );
    }
    // Stacked templates: 1 = image top, 4 = image bottom, 5 = image below title.
    const ordered =
      tpl === 4
        ? [titleEl, textEl, imageEl]
        : tpl === 5
          ? [titleEl, imageEl, textEl]
          : [imageEl, titleEl, textEl];
    const orderedWithKeys = ordered
      .filter((el) => el !== null)
      .map((el, i) => <Fragment key={i}>{el}</Fragment>);
    return (
      <section
        className={cn(editing && "relative pt-9")}
        style={sectionStyle}
        onContextMenu={editing ? handleContextMenu : undefined}
      >
        <header
          className={cn(
            editing && "cursor-pointer",
            isSelected && "outline-2 outline-primary outline",
          )}
          style={headerStyle}
        >
          {orderedWithKeys}
        </header>
        {rowToolbar}
        {rowContent(
          cyoa,
          row,
          viewport,
          editing,
          selection,
          onSelect,
          onAction,
          editTarget,
          onStartEdit,
          onCommitEdit,
          onContextMenu,
        )}
      </section>
    );
  }

  return (
    <section
      className={cn(editing && "relative pt-9")}
      style={sectionStyle}
      onContextMenu={editing ? handleContextMenu : undefined}
    >
      {rowToolbar}
      {rowContent(
        cyoa,
        row,
        viewport,
        editing,
        selection,
        onSelect,
        onAction,
        editTarget,
        onStartEdit,
        onCommitEdit,
        onContextMenu,
      )}
    </section>
  );
}

/** Row body: button row, result/group rows, or the choice grid. */
function rowContent(
  cyoa: UseCyoaResult,
  row: Row,
  viewport: number,
  editing = false,
  selection: VisualSelection | null = null,
  onSelect?: (selection: VisualSelection) => void,
  onAction?: (action: VisualEditAction, selection: VisualSelection) => void,
  editTarget: VisualEditTarget | null = null,
  onStartEdit?: (target: VisualEditTarget) => void,
  onCommitEdit?: (target: VisualEditTarget, value: string) => void,
  onContextMenu?: (selection: VisualSelection | null, event: React.MouseEvent) => void,
) {
  if (row.isResultRow) {
    return (
      <ResultRowContent
        cyoa={cyoa}
        row={row}
        viewport={viewport}
        editing={editing}
        selection={selection}
        onSelect={onSelect}
        onAction={onAction}
        editTarget={editTarget}
        onStartEdit={onStartEdit}
        onCommitEdit={onCommitEdit}
        onContextMenu={onContextMenu}
      />
    );
  }
  if (row.isGroupRow) {
    return (
      <GroupRowContent
        cyoa={cyoa}
        row={row}
        viewport={viewport}
        editing={editing}
        selection={selection}
        onSelect={onSelect}
        onAction={onAction}
        editTarget={editTarget}
        onStartEdit={onStartEdit}
        onCommitEdit={onCommitEdit}
        onContextMenu={onContextMenu}
      />
    );
  }
  return (
    <div className={cn("flex flex-wrap", rowJustifyClass(row))}>
      {sortedChoices(row).map((choice) => (
        <div
          key={choice.id}
          className={cn("min-w-0", effectiveChoiceWidth(row, choice, cyoa, viewport))}
          style={{ padding: choiceMargin(choice, row, cyoa.idx, cyoa.state) }}
        >
          <ChoiceView
            cyoa={cyoa}
            choice={choice}
            row={row}
            viewport={viewport}
            editing={editing}
            selection={selection}
            onSelect={onSelect}
            onAction={onAction}
            editTarget={editTarget}
            onStartEdit={onStartEdit}
            onCommitEdit={onCommitEdit}
            onContextMenu={onContextMenu}
          />
        </div>
      ))}
    </div>
  );
}

/** Row content justification (original `rowJustify` -> `justify-*` class). */
function RowButton({
  cyoa,
  row,
  editing = false,
}: {
  cyoa: UseCyoaResult;
  row: Row;
  editing?: boolean;
}) {
  const disabled = editing || isRowButtonDisabled(row, cyoa.state);
  // The row button carries only the row's button padding (original
  // `AppRow.rowButton`); the row header it sits in provides the background,
  // border and shadow via `rowSurfaceStyle`.
  const buttonStyle = rowButtonStyle(row, cyoa.idx, cyoa.state);
  const label =
    row.buttonText ||
    (row.btnPointAddon
      ? "Roll"
      : row.buttonId
        ? (cyoa.idx.variableMap.get(row.buttonId)?.id ?? "Button")
        : "Button");
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => cyoa.rowButton(row)}
      className={cn(
        "rounded-md px-4 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
        disabled && "cursor-not-allowed opacity-50",
      )}
      style={buttonStyle}
      dangerouslySetInnerHTML={renderHtml(label, cyoa.idx, cyoa.state)}
    />
  );
}

function ResultRowContent({
  cyoa,
  row,
  viewport,
  editing = false,
  selection = null,
  onSelect,
  onAction,
  editTarget = null,
  onStartEdit,
  onCommitEdit,
  onContextMenu,
}: {
  cyoa: UseCyoaResult;
  row: Row;
  viewport: number;
  editing?: boolean;
  selection?: VisualSelection | null;
  onSelect?: (selection: VisualSelection) => void;
  onAction?: (action: VisualEditAction, selection: VisualSelection) => void;
  editTarget?: VisualEditTarget | null;
  onStartEdit?: (target: VisualEditTarget) => void;
  onCommitEdit?: (target: VisualEditTarget, value: string) => void;
  onContextMenu?: (selection: VisualSelection | null, event: React.MouseEvent) => void;
}) {
  const entries = resultRowChoices(row, cyoa.idx, cyoa.state);
  const allowDeselect = cyoa.app.viewerSettings?.allowDeselect === true;
  if (entries.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap", rowJustifyClass(row))}>
      {entries.map(({ choice, row: origin }) => (
        <div
          key={choice.id}
          className={cn("min-w-0", effectiveChoiceWidth(row, choice, cyoa, viewport))}
          style={{ padding: choiceMargin(choice, row, cyoa.idx, cyoa.state) }}
        >
          <ChoiceView
            cyoa={cyoa}
            choice={choice}
            row={row}
            viewport={viewport}
            editing={editing}
            selection={selection}
            onSelect={onSelect}
            onAction={onAction}
            info={!allowDeselect}
            editTarget={editTarget}
            onStartEdit={onStartEdit}
            onCommitEdit={onCommitEdit}
            onContextMenu={onContextMenu}
          />
        </div>
      ))}
    </div>
  );
}

function GroupRowContent({
  cyoa,
  row,
  viewport,
  editing = false,
  selection = null,
  onSelect,
  onAction,
  editTarget = null,
  onStartEdit,
  onCommitEdit,
  onContextMenu,
}: {
  cyoa: UseCyoaResult;
  row: Row;
  viewport: number;
  editing?: boolean;
  selection?: VisualSelection | null;
  onSelect?: (selection: VisualSelection) => void;
  onAction?: (action: VisualEditAction, selection: VisualSelection) => void;
  editTarget?: VisualEditTarget | null;
  onStartEdit?: (target: VisualEditTarget) => void;
  onCommitEdit?: (target: VisualEditTarget, value: string) => void;
  onContextMenu?: (selection: VisualSelection | null, event: React.MouseEvent) => void;
}) {
  const entries = groupRowChoices(row, cyoa.idx);
  if (entries.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap", rowJustifyClass(row))}>
      {entries.map(({ choice, row: origin }) => (
        <div
          key={choice.id}
          className={cn("min-w-0", effectiveChoiceWidth(row, choice, cyoa, viewport))}
          style={{ padding: choiceMargin(choice, row, cyoa.idx, cyoa.state) }}
        >
          <ChoiceView
            cyoa={cyoa}
            choice={choice}
            row={row}
            viewport={viewport}
            editing={editing}
            selection={selection}
            onSelect={onSelect}
            onAction={onAction}
            info={row.isInfoRow}
            editTarget={editTarget}
            onStartEdit={onStartEdit}
            onCommitEdit={onCommitEdit}
            onContextMenu={onContextMenu}
          />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choice                                                             */
/* ------------------------------------------------------------------ */

import { useEffect, useRef } from "react";
import { MultiChoice } from "./MultiChoice";

import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import { cn } from "@/lib/utils";
import { hiddenContentsFor, isEnabled } from "@shared/cyoa-engine";
import type { Choice, NonSelectableAddon, Row, SelectableAddon } from "@shared/types";
import { getStyling } from "@shared/cyoa-styling";
import {
  choiceSurfaceStyle,
  imageStyle,
  isChoiceShown,
  numValue,
  renderHtml,
  resolveChoiceImage,
  templateClasses,
  textStyle,
  viewerTemplate,
} from "./cyoa-styles";
import { ViewerImage } from "./ViewerImage";
import { InlineTextEditor } from "@/components/editor/InlineTextEditor";
import { sortedChoices } from "@shared/project-selectors";
import type { VisualEditAction } from "./types";
import type { VisualSelection } from "./types";
import type { VisualEditTarget } from "./types";
import { PlayerImageButton } from "./PlayerImageButton";
import { EditToolbar } from "./EditToolbar";
import { rowJustifyClass } from "./layout";
import { Scores } from "./Scores";
import { Requirements } from "./Requirements";
import { AddonView } from "./AddonView";

interface ChoiceViewProps {
  cyoa: UseCyoaResult;
  choice: Choice;
  row: Row;
  /** Info rows ignore clicks (result/group/backpack rows). */
  info?: boolean;
  viewport?: number;
  /** Visual-editor mode: click selects the choice instead of toggling it. */
  editing?: boolean;
  selection?: VisualSelection | null;
  onSelect?: (selection: VisualSelection) => void;
  onAction?: (action: VisualEditAction, selection: VisualSelection) => void;
  editTarget?: VisualEditTarget | null;
  onStartEdit?: (target: VisualEditTarget) => void;
  onCommitEdit?: (target: VisualEditTarget, value: string) => void;
  onContextMenu?: (selection: VisualSelection | null, event: React.MouseEvent) => void;
}

export function ChoiceView({
  cyoa,
  choice,
  row,
  info = false,
  viewport = 0,
  editing = false,
  selection = null,
  onSelect,
  onAction,
  editTarget = null,
  onStartEdit,
  onCommitEdit,
  onContextMenu,
}: ChoiceViewProps) {
  const pendingClick = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelClick = () => clearTimeout(pendingClick.current);
  useEffect(() => cancelClick, []);
  const enabled = isEnabled(choice.requireds, cyoa.idx, cyoa.state);
  // A single-select choice is stored as `{ multiple: 0 }` — presence in the
  // activated map (not the count) means it is selected (matches the original
  // viewer's `isActive` flag semantics).
  const isSelected = cyoa.state.activated.has(choice.id);
  const isEditorSelected = editing && selection?.kind === "choice" && selection.id === choice.id;
  // Figma-style inline editing for the choice title/text.
  const isEditingTitle =
    editing &&
    editTarget?.kind === "choice" &&
    editTarget.id === choice.id &&
    editTarget.field === "title";
  const isEditingText =
    editing &&
    editTarget?.kind === "choice" &&
    editTarget.id === choice.id &&
    editTarget.field === "text";
  const startEdit =
    (field: "title" | "text") =>
    (event: React.MouseEvent): void => {
      if (!editing) return;
      cancelClick();
      event.stopPropagation();
      onSelect?.({ kind: "choice", id: choice.id });
      onStartEdit?.({ kind: "choice", id: choice.id, field });
    };
  const handleContextMenu = (event: React.MouseEvent): void => {
    if (info || !editing) return;
    cancelClick();
    event.preventDefault();
    event.stopPropagation();
    onSelect?.({ kind: "choice", id: choice.id });
    onContextMenu?.({ kind: "choice", id: choice.id }, event);
  };
  const isMulti = choice.isSelectableMultiple === true;
  const surface = choiceSurfaceStyle(choice, row, cyoa.idx, cyoa.state);
  const shown = isChoiceShown(choice, row, cyoa.idx, cyoa.state);
  const text = choice as Choice & { title?: string; text?: string };
  const titleStyle = textStyle("objectTitle", cyoa.idx, cyoa.state, row, choice);
  const textStyleObj = textStyle("objectText", cyoa.idx, cyoa.state, row, choice);
  const objectImageStyle = imageStyle("objectImage", cyoa.idx, cyoa.state, row, choice);
  const isCounterOnlyMulti = isMulti && !choice.allowSelectByClick;
  const isClickable = !info && !row.isInfoRow && !isCounterOnlyMulti && !choice.isNotSelectable;
  // Document-order position within the row for move-up/down affordances.
  const rowChoices = sortedChoices(row);
  const choiceIndex = rowChoices.findIndex((c) => c.id === choice.id);

  const hidden = hiddenContentsFor(row, cyoa.idx, cyoa.state);
  const nAddons = (choice.addons ?? []).filter((a): a is NonSelectableAddon => !a.isSelectable);
  const sAddons = (choice.addons ?? []).filter(
    (a): a is SelectableAddon => a.isSelectable === true,
  );
  // Content-hiding choices toggle the row's removal flags; the row JSON may
  // also set them directly (original `objectTitleRemoved` etc.).
  const titleRemoved = hidden.has("1") || row.objectTitleRemoved === true;
  const imageRemoved = hidden.has("2") || row.objectImageRemoved === true;
  const textRemoved = hidden.has("3") || row.objectTextRemoved === true;
  const scoreRemoved = hidden.has("4") || row.objectScoreRemoved === true;
  const reqRemoved = hidden.has("5") || row.objectRequirementRemoved === true;

  if (!shown) return null;

  const counter =
    isMulti && !choice.showMulInAddon ? (
      <MultiChoice cyoa={cyoa} choice={choice} row={row} editing={info} />
    ) : null;
  const counterPosition = numValue(
    getStyling("privateMultiChoiceIsOn", cyoa.idx, cyoa.state, row, choice)
      .multiChoiceCounterPosition,
  );

  // Scores/requirements move into the first addon when the choice opts into
  // `showScoreInAddon` / `showReqInAddon` (original viewer behavior).
  const showScores = !scoreRemoved && !choice.showScoreInAddon;
  const showReqs = !reqRemoved && !choice.showReqInAddon;

  const effTpl = row.choicesShareTemplate
    ? 1
    : viewerTemplate(choice, false, cyoa.app, viewport, cyoa.idx, cyoa.state);
  const tpl = templateClasses(effTpl);
  const imgStyle = {
    ...objectImageStyle,
    borderColor: surface.imageBorderColor || undefined,
  };
  const sideImage = effTpl === 2 || effTpl === 3;
  const imageBoxStyling = getStyling("privateObjectImageIsOn", cyoa.idx, cyoa.state, row, choice);
  const imageBoxWidth = Math.max(
    0,
    Math.min(100, Number(imageBoxStyling.objectImageBoxWidth ?? 50)),
  );

  // Template 5 flows the image inline (after requirements, before the text);
  // all other templates render it as the first/last flex child of the card.
  const choiceImage = resolveChoiceImage(choice, cyoa.idx, cyoa.state);
  const tplImageEl =
    choiceImage && !imageRemoved ? (
      <div className={tpl.image} style={sideImage ? { width: `${imageBoxWidth}%` } : undefined}>
        <ViewerImage
          src={choiceImage}
          title={choice.imageSourceTooltip || undefined}
          alt=""
          className={cn(
            "rounded-md border border-border",
            effTpl === 2 || effTpl === 3 ? "h-full w-full object-contain" : "w-full",
          )}
          style={imgStyle}
        />
      </div>
    ) : null;

  const addonsEl = (
    <>
      {nAddons.length > 0 ? (
        <div
          className={cn(
            "flex flex-wrap gap-y-3",
            rowJustifyClass({ rowJustify: choice.addonJustify } as Row),
          )}
        >
          {nAddons.map((addon, i) => (
            <AddonView
              key={addon.id}
              cyoa={cyoa}
              addon={addon}
              choice={choice}
              row={row}
              hidden={hidden}
              editing={info}
              viewport={viewport}
              isFirst={
                !addon.skipIndex &&
                sAddons.length === 0 &&
                i === nAddons.findIndex((a) => !a.skipIndex)
              }
            />
          ))}
        </div>
      ) : null}
      {sAddons.length > 0 ? (
        <div
          className={cn(
            "mt-3 flex flex-wrap gap-y-3",
            rowJustifyClass({ rowJustify: choice.addonJustify } as Row),
          )}
        >
          {sAddons.map((addon, i) => (
            <AddonView
              key={addon.id}
              cyoa={cyoa}
              addon={addon}
              choice={choice}
              row={row}
              hidden={hidden}
              editing={info}
              viewport={viewport}
              isFirst={
                !addon.skipIndex &&
                (nAddons.length === 0 || nAddons.every((a) => a.skipIndex)) &&
                i === sAddons.findIndex((a) => !a.skipIndex)
              }
            />
          ))}
        </div>
      ) : null}
    </>
  );

  const body = (
    <>
      {row.resultShowRowTitle ? (
        <h4
          style={textStyle("objectTitle", cyoa.idx, cyoa.state, row, choice)}
          dangerouslySetInnerHTML={renderHtml(
            cyoa.idx.choiceMap.get(choice.id)?.row.title ||
              cyoa.idx.choiceMap.get(choice.id)?.row.debugTitle ||
              "",
            cyoa.idx,
            cyoa.state,
          )}
        />
      ) : null}
      {isEditingTitle && !titleRemoved ? (
        <InlineTextEditor
          key={`choice-title:${choice.id}`}
          livePath={["$choices", choice.id, "title"]}
          sourceText={choice.title ?? ""}
          as="h3"
          html={renderHtml(text.title ?? "", cyoa.idx, cyoa.state).__html}
          style={titleStyle}
          className="font-semibold"
          onCommit={(value) =>
            onCommitEdit?.({ kind: "choice", id: choice.id, field: "title" }, value)
          }
        />
      ) : text.title && !titleRemoved ? (
        <h3
          className="font-semibold"
          style={titleStyle}
          onDoubleClick={startEdit("title")}
          dangerouslySetInnerHTML={renderHtml(text.title, cyoa.idx, cyoa.state)}
        />
      ) : null}
      {counterPosition === 0 ? counter : null}
      {/* Original viewer order: title, scores, requirements, then text. */}
      {showScores ? <Scores cyoa={cyoa} choice={choice} row={row} /> : null}
      {counterPosition === 1 ? counter : null}
      {showReqs ? (
        <Requirements cyoa={cyoa} choice={choice} row={row} textColor={surface.scoreColor} />
      ) : null}
      {counterPosition === 2 ? counter : null}
      {effTpl === 5 ? tplImageEl : null}
      {isEditingText && !textRemoved ? (
        <InlineTextEditor
          key={`choice-text:${choice.id}`}
          livePath={["$choices", choice.id, "text"]}
          sourceText={choice.text ?? ""}
          as="p"
          html={renderHtml(text.text ?? "", cyoa.idx, cyoa.state).__html}
          style={{
            ...textStyleObj,
            // Gap after the scores/requirements badges (the global
            // `.cyoa-viewer p` margin rule beats a margin utility class,
            // so set it inline).
            ...((showScores || showReqs) && { marginTop: 8 }),
          }}
          className="leading-5"
          onCommit={(value) =>
            onCommitEdit?.({ kind: "choice", id: choice.id, field: "text" }, value)
          }
        />
      ) : text.text && !textRemoved ? (
        <p
          className="leading-5"
          style={{
            ...textStyleObj,
            // Gap after the scores/requirements badges (the global
            // `.cyoa-viewer p` margin rule beats a margin utility class,
            // so set it inline).
            ...((showScores || showReqs) && { marginTop: 8 }),
          }}
          onDoubleClick={startEdit("text")}
          dangerouslySetInnerHTML={renderHtml(text.text, cyoa.idx, cyoa.state)}
        />
      ) : null}
      {counterPosition === 3 ? counter : null}
      {!choice.useSeperateAddon ? addonsEl : null}
      {counterPosition === 4 ? counter : null}
      {choice.isImageUpload && isSelected && !editing && !info ? (
        <PlayerImageButton onClick={() => cyoa.requestImage?.(choice.id)} />
      ) : null}
    </>
  );

  // Author styling controls the surface, including transparent backgrounds
  // and disabled borders; shell selection decorations must not override it.
  const docBackground = surface.backgroundColor || "transparent";
  const fullHeight =
    getStyling("privateObjectIsOn", cyoa.idx, cyoa.state, row, choice).objectHeight === true;

  const choiceToolbar =
    editing && !info ? (
      <EditToolbar
        kind="choice"
        selection={{ kind: "choice", id: choice.id }}
        canMoveUp={choiceIndex > 0}
        canMoveDown={choiceIndex >= 0 && choiceIndex < rowChoices.length - 1}
        onAction={onAction}
      />
    ) : null;

  return (
    <div
      data-cyoa-choice={choice.id}
      data-cyoa-locked={!enabled}
      className={cn(
        "relative flex flex-col text-start transition-colors",
        fullHeight && "h-full",
        `row-${row.id} choice-${choice.id}`,
        isSelected ? "choice-selected" : "choice-unselected",
        enabled ? "choice-enabled" : "choice-disabled",
        !enabled && "cursor-not-allowed",
        cyoa.app.isPointerCursor && isClickable && "cursor-pointer",
        editing && "cursor-pointer",
        isEditorSelected && "outline-2 outline-primary outline",
      )}
      style={{
        filter: surface.filter || undefined,
        backgroundColor: docBackground,
        backgroundImage: surface.gradient
          ? surface.gradient
          : surface.backgroundImage
            ? `url(${surface.backgroundImage})`
            : undefined,
        backgroundRepeat: surface.backgroundRepeat || undefined,
        backgroundSize: surface.backgroundSize || undefined,
        borderColor: surface.borderColor || undefined,
        borderStyle: surface.borderStyle || "none",
        borderWidth: surface.borderWidth || 0,
        borderRadius: surface.borderRadius || undefined,
        boxShadow: surface.boxShadow || undefined,
        overflow: surface.overflow || undefined,
        ...(surface.borderImage ? { borderImage: surface.borderImage } : {}),
      }}
      onClick={(event) => {
        if (
          info ||
          row.isInfoRow ||
          isCounterOnlyMulti ||
          (event.target as HTMLElement).closest(
            "button,a,input,textarea,select,[contenteditable=true]",
          )
        )
          return;
        const play = () => cyoa.toggleChoice(choice, cyoa.idx.choiceMap.get(choice.id)?.row ?? row);
        if (!editing) {
          play();
          return;
        }
        cancelClick();
        // Wait for a possible second click so inline editing has no gameplay side effects.
        if (event.detail < 2) pendingClick.current = setTimeout(play, 400);
      }}
      onContextMenu={handleContextMenu}
    >
      {choiceToolbar}
      <div className={cn(tpl.container, editing && !info && "pt-9")}>
        {effTpl !== 5 ? tplImageEl : null}
        <div className={cn("min-w-0", tpl.body)}>{body}</div>
      </div>
      {choice.useSeperateAddon ? <div className="mt-2 w-full">{addonsEl}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-choice counter                                               */
/* ------------------------------------------------------------------ */

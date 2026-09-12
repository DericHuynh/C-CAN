import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import { cn } from "@/lib/utils";
import { isEnabled } from "@shared/cyoa-engine";
import type { Addon, Choice, Row, SelectableAddon } from "@shared/types";
import { getStyling } from "@shared/cyoa-styling";
import { resolveImageRef } from "@shared/cyoa";
import {
  addonSurfaceStyle,
  choiceWidthClass,
  imageStyle,
  renderHtml,
  templateClasses,
  textStyle,
  viewerTemplate,
} from "./cyoa-styles";
import { ViewerImage } from "./ViewerImage";
import { MultiChoice } from "./MultiChoice";
import { Scores } from "./Scores";
import { Requirements } from "./Requirements";

export function AddonView({
  cyoa,
  addon,
  choice,
  row,
  hidden,
  isFirst = false,
  editing = false,
  viewport = 1280,
}: {
  cyoa: UseCyoaResult;
  addon: Addon;
  choice: Choice;
  row: Row;
  hidden?: Set<string>;
  isFirst?: boolean;
  editing?: boolean;
  viewport?: number;
}) {
  const enabled = isEnabled(addon.requireds, cyoa.idx, cyoa.state);
  const isSelectable = addon.isSelectable === true;
  const selected = isSelectable && cyoa.state.activated.has(addon.id);
  const choiceActive = cyoa.state.activated.has(choice.id);
  // Choice-level `showAllAddons` force-shows every addon of that choice
  // (mirrors the original bumping the global `app.showAllAddons` counter).
  const parentForceShows = choice.showAllAddons === true && choiceActive;
  const forceShow =
    cyoa.app.showAllAddons > 0 ||
    parentForceShows ||
    [...cyoa.state.activated.keys()].some((id) => cyoa.idx.choiceMap.get(id)?.choice.showAllAddons);
  // Content-hiding choices can toggle the row's `unselAddonRemoved` (9) and
  // `unmetAddonRemoved` (10) flags; the row JSON may also set them directly.
  const unselAddonRemoved = row.unselAddonRemoved === true || hidden?.has("9");
  const unmetAddonRemoved = row.unmetAddonRemoved === true || hidden?.has("10");
  // Visibility mirrors the original AppObject nAddons/sAddons filters:
  // non-selectable addons hide when unmet if `unmetAddonRemoved`; selectable
  // addons hide when unselected if `unselAddonRemoved`, and only selected
  // addons appear in result rows.
  const visible = isSelectable
    ? (!unselAddonRemoved || selected) &&
      (!row.isResultRow || selected) &&
      (forceShow || ((!addon.hideAddon || choiceActive) && (addon.showAddon || enabled)))
    : (!unmetAddonRemoved || enabled) &&
      (forceShow || ((!addon.hideAddon || choiceActive) && (addon.showAddon || enabled)));

  if (!visible) return null;
  const titleStyle = textStyle("addonTitle", cyoa.idx, cyoa.state, row, choice);
  const textStyleObj = textStyle("addonText", cyoa.idx, cyoa.state, row, choice);

  // `showScoreInAddon`/`showReqInAddon` render the parent's scores and
  // requirements inside the first addon instead of the choice body.
  const showParentScores = isFirst && choice.showScoreInAddon === true;
  const showParentReqs = isFirst && choice.showReqInAddon === true;
  const addonScores = (addon as SelectableAddon).scores ?? [];
  const addonReqs = addon.requireds ?? [];
  const template = viewerTemplate(addon, false, cyoa.app, viewport, cyoa.idx, cyoa.state);
  const layout = templateClasses(template);
  const imageSettings = getStyling("privateAddonImageIsOn", cyoa.idx, cyoa.state, row, choice);
  const image =
    addon.image && !hidden?.has("7") && row.addonImageRemoved !== true ? (
      <div className={layout.image}>
        <ViewerImage
          src={resolveImageRef(cyoa.app, addon.image)}
          alt=""
          title={addon.imageSourceTooltip || undefined}
          style={imageStyle(
            imageSettings.useAddonImage ? "addonImage" : "objectImage",
            cyoa.idx,
            cyoa.state,
            row,
            choice,
          )}
        />
      </div>
    ) : null;

  const inner = (
    <>
      {addon.title && !hidden?.has("6") && row.addonTitleRemoved !== true ? (
        <p
          className="text-sm font-medium"
          style={titleStyle}
          dangerouslySetInnerHTML={renderHtml(addon.title, cyoa.idx, cyoa.state)}
        />
      ) : null}
      {showParentScores && !hidden?.has("4") && row.objectScoreRemoved !== true ? (
        <Scores cyoa={cyoa} choice={choice} row={row} />
      ) : null}
      {showParentReqs && !hidden?.has("5") && row.objectRequirementRemoved !== true ? (
        <Requirements cyoa={cyoa} choice={choice} row={row} />
      ) : null}
      {isFirst && choice.showMulInAddon && choice.isSelectableMultiple ? (
        <MultiChoice cyoa={cyoa} choice={choice} row={row} editing={editing} />
      ) : null}
      {template === 5 ? image : null}
      {addon.text && !hidden?.has("8") && row.addonTextRemoved !== true ? (
        <p
          className="text-xs leading-4 text-muted-foreground"
          style={textStyleObj}
          dangerouslySetInnerHTML={renderHtml(addon.text, cyoa.idx, cyoa.state)}
        />
      ) : null}
      {!hidden?.has("4") && row.objectScoreRemoved !== true && addonScores.length > 0 ? (
        <Scores cyoa={cyoa} choice={addon as Choice} row={row} />
      ) : null}
      {!hidden?.has("5") && row.objectRequirementRemoved !== true && addonReqs.length > 0 ? (
        <Requirements cyoa={cyoa} choice={addon as Choice} row={row} textColor={undefined} />
      ) : null}
      {isSelectable ? (
        <SelectableAddonControls
          cyoa={cyoa}
          addon={addon}
          choice={choice}
          row={row}
          enabled={enabled}
          editing={editing}
        />
      ) : null}
    </>
  );

  const clickable = isSelectable && !editing && !row.isInfoRow && (enabled || selected);
  const activate = () => {
    if (clickable && addon.isSelectable)
      cyoa.toggleAddon(addon, choice, cyoa.idx.choiceMap.get(choice.id)?.row ?? row);
  };
  return (
    <div
      data-cyoa-addon={addon.id}
      data-cyoa-locked={!enabled}
      role={isSelectable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-disabled={isSelectable ? !clickable : undefined}
      onClick={(event) => {
        if (!isSelectable) return;
        event.stopPropagation();
        activate();
      }}
      onKeyDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          !clickable ||
          !["Enter", " "].includes(event.key)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        activate();
      }}
      aria-pressed={isSelectable ? selected : undefined}
      className={cn(
        "min-w-0 text-start",
        choiceWidthClass(
          { ...row, overrideWidth: false, objectWidth: addon.addonWidth || "col-12" },
          { ...choice, objectWidth: addon.addonWidth || "col-12" },
          cyoa.app,
          viewport,
        ),
        cyoa.app.isPointerCursor && clickable && "cursor-pointer",
      )}
      style={addonSurfaceStyle(addon, choice, row, cyoa.idx, cyoa.state)}
    >
      <div className={layout.container}>
        {template !== 5 ? image : null}
        <div className={cn("min-w-0", layout.body)}>{inner}</div>
      </div>
    </div>
  );
}

function SelectableAddonControls({
  cyoa,
  addon,
  choice,
  row,
  enabled,
  editing = false,
}: {
  cyoa: UseCyoaResult;
  addon: SelectableAddon;
  choice: Choice;
  row: Row;
  enabled: boolean;
  editing?: boolean;
}) {
  const entry = cyoa.state.activated.get(addon.id);
  const count = entry?.multiple ?? 0;
  const isMulti = addon.isSelectableMultiple === true;
  if (isMulti) {
    return <MultiChoice cyoa={cyoa} choice={addon} row={row} editing={editing || !enabled} />;
  }
  if (!enabled && !entry) return null;
  return (
    <span className="mt-1 block text-xs text-muted-foreground">
      {entry ? "Selected" : "Click to select"}
      <span className="hidden">{choice.id}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Backpack dialog                                                    */
/* ------------------------------------------------------------------ */

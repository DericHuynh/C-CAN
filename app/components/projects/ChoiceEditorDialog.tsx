import { useMemo, useState } from "react";
import { useParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "@/hooks/use-projects";
import { createDefaultAddon } from "@shared/cyoa";
import type {
  Addon,
  Choice,
  Group,
  PointType,
  Requireds,
  Score,
} from "@shared/types";

import { pointTypeName } from "./project-utils";
import { RequirementListEditor } from "./RequirementListEditor";
import { ChoiceFunctionsEditor } from "./ChoiceFunctionsEditor";

interface ChoiceEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choice: Choice | null;
  pointTypes: PointType[];
  groups: Group[];
  busy?: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}

const TEMPLATES: { value: string; label: string }[] = [
  { value: "1", label: "Image Top" },
  { value: "2", label: "Image Right" },
  { value: "3", label: "Image Left" },
  { value: "4", label: "Image Bottom" },
  { value: "5", label: "Image Center" },
];

const OBJECT_WIDTHS: { value: string; label: string }[] = [
  { value: "row", label: "Row (inherit)" },
  { value: "col-12", label: "1 per row" },
  { value: "col-sm-11", label: "11/12" },
  { value: "col-sm-10", label: "10/12" },
  { value: "col-sm-9", label: "9/12" },
  { value: "col-sm-8", label: "8/12" },
  { value: "col-sm-7", label: "7/12" },
  { value: "col-sm-6", label: "2 per row" },
  { value: "col-sm-5", label: "5/12" },
  { value: "col-md-4", label: "3 per row" },
  { value: "col-md-3", label: "4 per row" },
  { value: "w-20", label: "5 per row" },
  { value: "col-lg-2", label: "6 per row" },
  { value: "w-14", label: "7 per row" },
  { value: "w-12", label: "8 per row" },
  { value: "w-11", label: "9 per row" },
  { value: "w-10", label: "10 per row" },
  { value: "w-9", label: "11 per row" },
  { value: "col-xl-1", label: "12 per row" },
];

const VARIABLE_CHANGE_TYPES: { value: string; label: string }[] = [
  { value: "1", label: "Set true" },
  { value: "2", label: "Set false" },
  { value: "3", label: "Toggle" },
];

/** Choice-function keys editable through ChoiceFunctionsEditor. */
const FUNCTION_KEYS: string[] = [
  "useSlider",
  "hideCounter",
  "hideMultipleCounter",
  "multipleScoreId",
  "isCountDisabled",
  "activateOtherChoice",
  "activateThisChoice",
  "isAllowDeselect",
  "isNotDeactivate",
  "activateAfterReset",
  "isActivateRandom",
  "numActivateRandom",
  "isNotActiveUnselectable",
  "deactivateOtherChoice",
  "deactivateThisChoice",
  "discountOther",
  "discountOperator",
  "discountValue",
  "stackableDiscount",
  "isDisChoices",
  "discountChoices",
  "discountRows",
  "discountGroups",
  "discountPointTypes",
  "discountLowLimitIsOn",
  "discountLowLimit",
  "useDiscountCount",
  "discountCount",
  "countPerSelection",
  "discountShow",
  "discountBeforeText",
  "discountAfterText",
  "replaceScoreText",
  "hideScoreValue",
  "hideScoreIcon",
  "duplicateRow",
  "duplicateRowId",
  "duplicateRowPlace",
  "dRowAddSufReq",
  "dRowAddSufFunc",
  "isContentHidden",
  "hiddenContentsRow",
  "hiddenContentsType",
  "addToAllowChoice",
  "idOfAllowChoice",
  "numbAddToAllowChoice",
  "showAllAddons",
  "notDeselectedByClean",
  "useSeperateAddon",
  "showScoreInAddon",
  "showReqInAddon",
  "deselectWhenNoAddon",
  "changeTemplates",
  "changeTemplatesList",
  "changeToThisTemplate",
  "changeAddonTemplate",
  "changeWidth",
  "changeWidthList",
  "changeToThisWidth",
  "scrollToRow",
  "scrollToObject",
  "scrollRowId",
  "scrollObjectId",
  "changePointBar",
  "changeBarBgColorIsOn",
  "changedBarBgColor",
  "changeBarTextColorIsOn",
  "changedBarTextColor",
  "changeBarIconColorIsOn",
  "changedBarIconColor",
  "changeBackground",
  "changeBgImage",
  "bgImage",
  "changedBgColorCode",
  "setBgmIsOn",
  "bgmId",
  "useAudioURL",
  "bgmFadeIn",
  "bgmFadeOut",
  "bgmFadeInSec",
  "bgmFadeOutSec",
  "bgmNoLoop",
  "muteBgm",
  "isFadeTransition",
  "fadeTransitionColor",
  "fadeInTransitionTime",
  "fadeOutTransitionTime",
  "multiplyPointtypeIsOn",
  "pointTypeToMultiply",
  "multiplyWithThis",
  "multiplyPointtypeIsId",
  "dividePointtypeIsOn",
  "pointTypeToDivide",
  "divideWithThis",
  "setPointtypeIsOn",
  "pointTypeToSet",
  "setWithThis",
  "textfieldIsOn",
  "idOfTheTextfieldWord",
  "wordPromptText",
  "wordChangeSelect",
  "wordChangeDeselect",
  "confirmIsOn",
  "isSelectDelayed",
  "selectDelayTime",
  "isDeselectDelayed",
  "deselectDelayTime",
  "useSfx",
  "sfxOnSelect",
  "sfxIdOnSelect",
  "sfxOnDeselect",
  "sfxIdOnDeselect",
  "backpackBtnRequirement",
  "randomWeight",
  "defaultImage",
];

export function ChoiceEditorDialog({
  open,
  onOpenChange,
  choice,
  pointTypes,
  groups,
  busy = false,
  onSave,
}: ChoiceEditorDialogProps) {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: project } = useProject(projectId);
  const app = project?.app;

  const [title, setTitle] = useState(choice?.title ?? "");
  const [text, setText] = useState(choice?.text ?? "");
  const [groupIds, setGroupIds] = useState<string[]>(choice?.groups ?? []);
  const [scores, setScores] = useState<Score[]>(choice?.scores ?? []);
  const [scorePointType, setScorePointType] = useState<string>("");
  const [scoreValue, setScoreValue] = useState("");

  const [image, setImage] = useState(choice?.image ?? "");
  const [template, setTemplate] = useState(choice?.template ?? 1);
  const [objectWidth, setObjectWidth] = useState(choice?.objectWidth ?? "");

  const [isSelectableMultiple, setIsSelectableMultiple] = useState(
    choice?.isSelectableMultiple ?? false,
  );
  const [numMultipleTimesPluss, setNumMultipleTimesPluss] = useState(
    choice?.numMultipleTimesPluss != null
      ? String(choice.numMultipleTimesPluss)
      : "0",
  );
  const [numMultipleTimesMinus, setNumMultipleTimesMinus] = useState(
    choice?.numMultipleTimesMinus != null
      ? String(choice.numMultipleTimesMinus)
      : "0",
  );
  const [allowSelectByClick, setAllowSelectByClick] = useState(
    choice?.allowSelectByClick ?? false,
  );
  const [isMultipleUseVariable, setIsMultipleUseVariable] = useState(
    choice?.isMultipleUseVariable ?? false,
  );

  const [isNotSelectable, setIsNotSelectable] = useState(
    choice?.isNotSelectable ?? false,
  );
  const [selectOnce, setSelectOnce] = useState(choice?.selectOnce ?? false);
  const [isAutoActive, setIsAutoActive] = useState(choice?.isAutoActive ?? false);
  const [isNotResult, setIsNotResult] = useState(choice?.isNotResult ?? false);
  const [isNotSearchable, setIsNotSearchable] = useState(
    choice?.isNotSearchable ?? false,
  );
  const [isImageUpload, setIsImageUpload] = useState(
    choice?.isImageUpload ?? false,
  );
  const [cleanACtivatedOnSelect, setCleanACtivatedOnSelect] = useState(
    choice?.cleanACtivatedOnSelect ?? false,
  );
  const [hideCounterUntilSelect, setHideCounterUntilSelect] = useState(
    choice?.hideCounterUntilSelect ?? false,
  );

  const [isChangeVariables, setIsChangeVariables] = useState(
    choice?.isChangeVariables ?? false,
  );
  const [changedVariables, setChangedVariables] = useState(
    choice?.changedVariables?.join(", ") ?? "",
  );
  const [changeType, setChangeType] = useState(choice?.changeType ?? "1");

  const [addons, setAddons] = useState<Addon[]>(choice?.addons ?? []);
  const [requireds, setRequireds] = useState<Requireds[]>(
    choice?.requireds ?? [],
  );

  // Choice functions (ChoiceFunc): seeded from the current choice, merged
  // into the save patch.
  const [functions, setFunctions] = useState<Record<string, unknown>>(() => {
    const source = (choice ?? {}) as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of FUNCTION_KEYS) {
      if (source[key] !== undefined) out[key] = source[key];
    }
    return out;
  });

  const usedPointTypeIds = useMemo(
    () => new Set(scores.map((score) => score.id ?? score.type).filter(Boolean)),
    [scores],
  );
  const availablePointTypes = pointTypes.filter(
    (pt) => !usedPointTypeIds.has(pt.id),
  );

  const allChoices = useMemo(() => {
    const result: { id: string; label: string }[] = [];
    for (const row of app?.rows ?? []) {
      for (const object of row.objects ?? []) {
        result.push({ id: object.id, label: `${object.id} | ${object.title}` });
      }
    }
    return result;
  }, [app]);

  const globalRequirementOptions = useMemo(
    () =>
      (app?.globalRequirements ?? []).map((requirement) => ({
        id: requirement.id,
        name: requirement.name,
      })),
    [app],
  );

  const rowOptions = useMemo(
    () =>
      (app?.rows ?? []).map((row) => ({
        id: row.id,
        label: `${row.id} | ${row.title}`,
      })),
    [app],
  );

  const groupOptions = useMemo(
    () =>
      (groups ?? []).map((group) => ({
        id: group.id,
        label: `${group.id} | ${group.name}`,
      })),
    [groups],
  );

  const sfxOptions = useMemo(
    () =>
      (app?.soundEffects ?? []).map((sfx) => ({
        id: sfx.id,
        label: `${sfx.id} | ${sfx.name}`,
      })),
    [app],
  );

  function toggleGroup(groupId: string) {
    setGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  }

  function updateScoreValue(score: Score, value: string) {
    setScores((prev) =>
      prev.map((item) =>
        item === score ? { ...item, value: Number(value) || 0 } : item,
      ),
    );
  }

  function removeScore(score: Score) {
    setScores((prev) => prev.filter((item) => item !== score));
  }

  function addScore() {
    const pointType = pointTypes.find((pt) => pt.id === scorePointType);
    if (!pointType) return;
    const value = Number(scoreValue) || 0;
    setScores((prev) => [
      ...prev,
      {
        idx: String(prev.length),
        id: pointType.id,
        type: pointType.id,
        value,
        beforeText: pointType.beforeText ?? "",
        afterText: pointType.afterText ?? "",
        requireds: [],
        showScore: true,
      } as Score,
    ]);
    setScorePointType("");
    setScoreValue("");
  }

  function updateAddon(addon: Addon, patch: Partial<Addon>) {
    setAddons((prev) =>
      prev.map((item) => (item === addon ? ({ ...item, ...patch } as Addon) : item)),
    );
  }

  function removeAddon(addon: Addon) {
    setAddons((prev) => prev.filter((item) => item !== addon));
  }

  function addAddon() {
    if (!app) return;
    const base = createDefaultAddon(app);
    setAddons((prev) => [
      ...prev,
      {
        ...base,
        isSelectable: true,
        scores: [],
        groups: [],
        multipleUseVariable: 0,
        isActive: false,
      } as Addon,
    ]);
  }

  function handleSave() {
    onSave({
      title,
      text,
      groups: groupIds,
      scores,
      image,
      template,
      objectWidth,
      isSelectableMultiple,
      numMultipleTimesPluss: Number(numMultipleTimesPluss) || 0,
      numMultipleTimesMinus: Number(numMultipleTimesMinus) || 0,
      allowSelectByClick,
      isMultipleUseVariable,
      isNotSelectable,
      selectOnce,
      isAutoActive,
      isNotResult,
      isNotSearchable,
      isImageUpload,
      cleanACtivatedOnSelect,
      hideCounterUntilSelect,
      isChangeVariables,
      changedVariables: changedVariables
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
      changeType,
      addons,
      requireds,
      ...functions,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit choice</DialogTitle>
          <DialogDescription>
            Update the choice's title, text, groups, point scores, and
            appearance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="choice-title">Title</Label>
            <Input
              id="choice-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Choice title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="choice-text">Text</Label>
            <Textarea
              id="choice-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Optional description shown inside the choice"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="choice-image">Image URL</Label>
              <Input
                id="choice-image"
                value={image}
                onChange={(event) => setImage(event.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choice-template">Template</Label>
              <Select
                value={String(template)}
                onValueChange={(value) => setTemplate(Number(value))}
              >
                <SelectTrigger id="choice-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="choice-width">Width</Label>
            <Select
              value={objectWidth === "" ? "row" : objectWidth}
              onValueChange={(value) =>
                setObjectWidth(value === "row" ? "" : value)
              }
            >
              <SelectTrigger id="choice-width" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OBJECT_WIDTHS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {groups.length > 0 ? (
            <div className="space-y-2">
              <Label>Groups</Label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={groupIds.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <span className="min-w-0 truncate">{group.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Choices in the same group are mutually exclusive in the viewer.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Scores</Label>
            {scores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No point scores yet. Add one below to make this choice cost or
                grant points.
              </p>
            ) : (
              <div className="space-y-1.5">
                {scores.map((score, index) => (
                  <div
                    key={`${score.id ?? score.type}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <Badge
                      variant="secondary"
                      className="w-28 shrink-0 justify-center overflow-hidden text-ellipsis"
                      title={pointTypeName(pointTypes, score.id ?? score.type)}
                    >
                      {pointTypeName(pointTypes, score.id ?? score.type)}
                    </Badge>
                    <Input
                      type="number"
                      value={String(score.value ?? 0)}
                      onChange={(event) => updateScoreValue(score, event.target.value)}
                      className="w-24"
                      aria-label={`Value for ${pointTypeName(pointTypes, score.id ?? score.type)}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {score.value !== undefined && score.value < 0
                        ? "cost"
                        : "gain"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      onClick={() => removeScore(score)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {availablePointTypes.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2 pt-1">
                <div className="min-w-40 flex-1 space-y-1">
                  <Label htmlFor="new-score-point-type">Point type</Label>
                  <Select
                    value={scorePointType}
                    onValueChange={setScorePointType}
                  >
                    <SelectTrigger id="new-score-point-type" className="w-full">
                      <SelectValue placeholder="Select a point type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePointTypes.map((pt) => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1">
                  <Label htmlFor="new-score-value">Value</Label>
                  <Input
                    id="new-score-value"
                    type="number"
                    value={scoreValue}
                    onChange={(event) => setScoreValue(event.target.value)}
                    placeholder="e.g. -5"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9"
                  onClick={addScore}
                  disabled={!scorePointType}
                  aria-label="Add score"
                  title="Add score"
                >
                  +
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                All point types are already scored. Add a point type on the
                Points tab to attach more scores.
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={isSelectableMultiple}
                  onCheckedChange={(checked) =>
                    setIsSelectableMultiple(checked === true)
                  }
                />
                Allow multiple selection
              </label>
            </div>
            {isSelectableMultiple ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="choice-multi-pluss">Max selections</Label>
                    <Input
                      id="choice-multi-pluss"
                      type="number"
                      min={0}
                      value={numMultipleTimesPluss}
                      onChange={(event) =>
                        setNumMultipleTimesPluss(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="choice-multi-minus">Min selections</Label>
                    <Input
                      id="choice-multi-minus"
                      type="number"
                      min={0}
                      value={numMultipleTimesMinus}
                      onChange={(event) =>
                        setNumMultipleTimesMinus(event.target.value)
                      }
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={allowSelectByClick}
                    onCheckedChange={(checked) =>
                      setAllowSelectByClick(checked === true)
                    }
                  />
                  Allow select by click
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={isMultipleUseVariable}
                    onCheckedChange={(checked) =>
                      setIsMultipleUseVariable(checked === true)
                    }
                  />
                  Track selections in a variable
                </label>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Behavior</Label>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {[
                { label: "Not selectable", checked: isNotSelectable, set: setIsNotSelectable },
                { label: "Select once", checked: selectOnce, set: setSelectOnce },
                { label: "Auto active", checked: isAutoActive, set: setIsAutoActive },
                { label: "Not a result", checked: isNotResult, set: setIsNotResult },
                { label: "Not searchable", checked: isNotSearchable, set: setIsNotSearchable },
                { label: "Image upload", checked: isImageUpload, set: setIsImageUpload },
                { label: "Clean activated on select", checked: cleanACtivatedOnSelect, set: setCleanACtivatedOnSelect },
                { label: "Hide counter until selected", checked: hideCounterUntilSelect, set: setHideCounterUntilSelect },
              ].map((flag) => (
                <label
                  key={flag.label}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
                >
                  <Checkbox
                    checked={flag.checked}
                    onCheckedChange={(checked) => flag.set(checked === true)}
                  />
                  <span className="min-w-0 truncate">{flag.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={isChangeVariables}
                onCheckedChange={(checked) =>
                  setIsChangeVariables(checked === true)
                }
              />
              Change variables
            </label>
            {isChangeVariables ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="choice-changed-variables">
                    Variable ids (comma-separated)
                  </Label>
                  <Input
                    id="choice-changed-variables"
                    value={changedVariables}
                    onChange={(event) => setChangedVariables(event.target.value)}
                    placeholder="var-1, var-2"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="choice-change-type">Change</Label>
                  <Select
                    value={changeType}
                    onValueChange={setChangeType}
                  >
                    <SelectTrigger id="choice-change-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VARIABLE_CHANGE_TYPES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Addons</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAddon}
                disabled={!app}
              >
                Add addon
              </Button>
            </div>
            {addons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No addons yet. Addons are extra blocks shown inside the choice.
              </p>
            ) : (
              <div className="space-y-3">
                {addons.map((addon, index) => (
                  <div
                    key={addon.id ?? `addon-${index}`}
                    className="space-y-2 rounded-md border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {addon.title || "Untitled addon"}
                      </span>
                      <Badge variant="secondary">
                        {addon.isSelectable ? "Selectable" : "Not selectable"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Label>Title</Label>
                      <Input
                        value={addon.title ?? ""}
                        onChange={(event) =>
                          updateAddon(addon, { title: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Text</Label>
                      <Input
                        value={addon.text ?? ""}
                        onChange={(event) =>
                          updateAddon(addon, { text: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Image URL</Label>
                      <Input
                        value={addon.image ?? ""}
                        onChange={(event) =>
                          updateAddon(addon, { image: event.target.value })
                        }
                        placeholder="https://…"
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={addon.isSelectable ?? false}
                        onCheckedChange={(checked) =>
                          updateAddon(addon, { isSelectable: checked === true })
                        }
                      />
                      Selectable
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Template</Label>
                        <Select
                          value={String(addon.template ?? 1)}
                          onValueChange={(value) =>
                            updateAddon(addon, { template: Number(value) })
                          }
                        >
                          <SelectTrigger className="h-8 w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TEMPLATES.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Width</Label>
                        <Select
                          value={addon.addonWidth || "col-12"}
                          onValueChange={(value) =>
                            updateAddon(addon, { addonWidth: value })
                          }
                        >
                          <SelectTrigger className="h-8 w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OBJECT_WIDTHS.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={addon.showAddon === true}
                          onCheckedChange={(checked) =>
                            updateAddon(addon, { showAddon: checked === true })
                          }
                        />
                        Always show
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={addon.hideAddon === true}
                          onCheckedChange={(checked) =>
                            updateAddon(addon, { hideAddon: checked === true })
                          }
                        />
                        Hide until parent selected
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={addon.skipIndex === true}
                          onCheckedChange={(checked) =>
                            updateAddon(addon, { skipIndex: checked === true })
                          }
                        />
                        Skip index
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={(addon as unknown as Record<string, unknown>).countAsChoice === true}
                          onCheckedChange={(checked) =>
                            updateAddon(addon, { countAsChoice: checked === true })
                          }
                        />
                        Counts toward row limit
                      </label>
                      {addon.isSelectable ? (
                        <>
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                              checked={addon.deselectParent === true}
                              onCheckedChange={(checked) =>
                                updateAddon(addon, { deselectParent: checked === true })
                              }
                            />
                            Deselect parent with addon
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                              checked={addon.deselectWhenNoAddon === true}
                              onCheckedChange={(checked) =>
                                updateAddon(addon, { deselectWhenNoAddon: checked === true })
                              }
                            />
                            Deselect parent when none remain
                          </label>
                        </>
                      ) : null}
                    </div>
                    {addon.isSelectable ? (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Groups (comma-separated ids)
                          </Label>
                          <Input
                            className="h-8 text-sm"
                            value={((addon.groups as string[]) ?? []).join(", ")}
                            onChange={(event) =>
                              updateAddon(addon, {
                                groups: event.target.value
                                  .split(",")
                                  .map((part) => part.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="group-id"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Addon scores (selectable addons can carry their own
                            point scores)
                          </Label>
                          {(addon.scores ?? []).map((score, scoreIndex) => (
                            <div key={`${score.id ?? score.type}-${scoreIndex}`} className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="w-28 shrink-0 justify-center overflow-hidden text-ellipsis"
                                title={pointTypeName(pointTypes, score.id ?? score.type)}
                              >
                                {pointTypeName(pointTypes, score.id ?? score.type)}
                              </Badge>
                              <Input
                                type="number"
                                className="h-8 w-24 text-sm"
                                value={String(score.value ?? 0)}
                                onChange={(event) =>
                                  updateAddon(addon, {
                                    scores: (addon.scores ?? []).map((item) =>
                                      item === score
                                        ? { ...item, value: Number(event.target.value) || 0 }
                                        : item,
                                    ),
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  updateAddon(addon, {
                                    scores: (addon.scores ?? []).filter((item) => item !== score),
                                  })
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          {pointTypes.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Select
                                value={""}
                                onValueChange={(pointTypeId) => {
                                  const pointType = pointTypes.find((pt) => pt.id === pointTypeId);
                                  if (!pointType) return;
                                  updateAddon(addon, {
                                    scores: [
                                      ...(addon.scores ?? []),
                                      {
                                        idx: String((addon.scores ?? []).length),
                                        id: pointType.id,
                                        type: pointType.id,
                                        value: 0,
                                        beforeText: pointType.beforeText ?? "",
                                        afterText: pointType.afterText ?? "",
                                        requireds: [],
                                        showScore: true,
                                      } as Score,
                                    ],
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 w-full text-sm">
                                  <SelectValue placeholder="Add a score…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {pointTypes.map((pt) => (
                                    <SelectItem key={pt.id} value={pt.id}>
                                      {pt.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeAddon(addon)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <Label>Requirements</Label>
            <RequirementListEditor
              requireds={requireds}
              onChange={setRequireds}
              choices={allChoices}
              pointTypes={pointTypes}
              globalRequirements={globalRequirementOptions}
            />
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <Label>Functions</Label>
            <p className="text-xs text-muted-foreground">
              Runtime behaviors: linked activation, discounts, duplication,
              template/width/background changes, music, fades, delays, sounds
              and more.
            </p>
            <ChoiceFunctionsEditor
              value={functions}
              onChange={setFunctions}
              choices={allChoices}
              rows={rowOptions}
              groups={groupOptions}
              pointTypes={pointTypes}
              soundEffects={sfxOptions}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={busy}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

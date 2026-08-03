import { memo, useMemo, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@agent-native/toolkit/ui/radio-group";

import { Checkbox } from "@/components/ui/checkbox";
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
import type { App, Requireds, Row } from "@shared/types";

import { EditorPane } from "./EditorPane";
import { LazySelect } from "./LazySelect";
import { RequirementListEditor } from "./RequirementListEditor";

interface RowEditorProps {
  row: Row | null;
  app: App;
  busy?: boolean;
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}

const TEMPLATES: { value: string; label: string }[] = [
  { value: "1", label: "Image Top" },
  { value: "2", label: "Image Right" },
  { value: "3", label: "Image Left" },
  { value: "4", label: "Image Bottom" },
  { value: "5", label: "Image Center" },
];

const ROW_JUSTIFIES = ["start", "center", "end"];

type RowKind = "normal" | "info" | "result" | "group" | "button";

const ROW_KINDS: { value: RowKind; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "info", label: "Info / non-activatable" },
  { value: "result", label: "Result row" },
  { value: "group", label: "Group row" },
  { value: "button", label: "Button row" },
];

export const RowEditor = memo(function RowEditor({
  row,
  app,
  busy = false,
  onCancel,
  onSave,
}: RowEditorProps) {
  const [title, setTitle] = useState(row?.title ?? "");
  const [titleText, setTitleText] = useState(row?.titleText ?? "");
  const [image, setImage] = useState(row?.image ?? "");
  const [allowedChoices, setAllowedChoices] = useState(
    row?.allowedChoices != null ? String(row.allowedChoices) : "0",
  );
  const [objectWidth, setObjectWidth] = useState(row?.objectWidth ?? "");
  const [template, setTemplate] = useState(row?.template ?? 1);

  const [rowKind, setRowKind] = useState<RowKind>(() => {
    if (row?.isButtonRow) return "button";
    if (row?.isInfoRow) return "info";
    if (row?.isResultRow) return "result";
    if (row?.isGroupRow) return "group";
    return "normal";
  });
  const [resultGroupId, setResultGroupId] = useState(row?.resultGroupId ?? "");

  const [buttonText, setButtonText] = useState(row?.buttonText ?? "");
  const [buttonTypeRadio, setButtonTypeRadio] = useState(row?.buttonTypeRadio ?? "choiceselect");
  const [buttonId, setButtonId] = useState(row?.buttonId ?? "");
  const [buttonRandom, setButtonRandom] = useState(row?.buttonRandom ?? false);
  const [buttonRandomNumber, setButtonRandomNumber] = useState(
    row?.buttonRandomNumber != null ? String(row.buttonRandomNumber) : "1",
  );
  const [isWeightedRandom, setIsWeightedRandom] = useState(row?.isWeightedRandom ?? false);
  const [onlyUnselectedChoices, setOnlyUnselectedChoices] = useState(
    row?.onlyUnselectedChoices ?? false,
  );
  const [allowActivateUnselectable, setAllowActivateUnselectable] = useState(
    row?.allowActivateUnselectable ?? false,
  );
  const [pointTypeRandom, setPointTypeRandom] = useState(row?.pointTypeRandom ?? "");
  const [randomMin, setRandomMin] = useState(row?.randomMin != null ? String(row.randomMin) : "0");
  const [randomMax, setRandomMax] = useState(row?.randomMax != null ? String(row.randomMax) : "0");

  const [width, setWidth] = useState(row?.width ?? false);
  const [deselectChoices, setDeselectChoices] = useState(row?.deselectChoices ?? false);
  const [rowJustify, setRowJustify] = useState(row?.rowJustify ?? "start");
  const [requireds, setRequireds] = useState<Requireds[]>(row?.requireds ?? []);

  const choices = useMemo(() => {
    const result: { id: string; label: string }[] = [];
    for (const appRow of app?.rows ?? []) {
      for (const object of appRow.objects ?? []) {
        result.push({ id: object.id, label: `${object.id} | ${object.title}` });
      }
    }
    return result;
  }, [app]);

  const pointTypeOptions = useMemo(
    () =>
      (app?.pointTypes ?? []).map((pointType) => ({
        id: pointType.id,
        name: pointType.name,
      })),
    [app],
  );

  const globalRequirementOptions = useMemo(
    () =>
      (app?.globalRequirements ?? []).map((requirement) => ({
        id: requirement.id,
        name: requirement.name,
      })),
    [app],
  );

  const imageItems = useMemo(
    () =>
      (app?.images ?? []).map((img) => ({
        value: img.id,
        label: img.name || img.id,
        searchText: `${img.name} ${img.id}`,
      })),
    [app],
  );

  function handleSave() {
    const choicesCount = Math.max(0, Number(allowedChoices) || 0);
    const isResult = rowKind === "result";
    const isGroup = rowKind === "group";
    const isButton = rowKind === "button";

    const patch: Record<string, unknown> = {
      title,
      titleText,
      // "__custom__" is a UI-only marker for the image select — never persist it.
      image: image === "__custom__" ? "" : image,
      allowedChoices: choicesCount,
      objectWidth,
      template,
      isInfoRow: rowKind === "info",
      isResultRow: isResult,
      isGroupRow: isGroup,
      isButtonRow: isButton,
      width,
      deselectChoices,
      rowJustify,
      requireds,
    };

    if (isResult || isGroup) {
      patch.resultGroupId = resultGroupId;
    }

    if (isButton) {
      patch.buttonText = buttonText;
      patch.buttonTypeRadio = buttonTypeRadio;
      if (buttonTypeRadio === "sumaddon") {
        patch.btnPointAddon = true;
        patch.pointTypeRandom = pointTypeRandom;
        patch.randomMin = Number(randomMin) || 0;
        patch.randomMax = Number(randomMax) || 0;
      } else {
        patch.buttonId = buttonId;
        patch.buttonRandom = buttonRandom;
        patch.buttonRandomNumber = Number(buttonRandomNumber) || 0;
        patch.isWeightedRandom = isWeightedRandom;
        patch.onlyUnselectedChoices = onlyUnselectedChoices;
        patch.allowActivateUnselectable = allowActivateUnselectable;
      }
    }

    onSave(patch);
  }

  return (
    <EditorPane
      title="Edit row"
      description="Update the row's title, description, image, kind, and selection rules."
      busy={busy}
      onCancel={onCancel}
      onSave={handleSave}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="row-title">Title</Label>
          <Input
            id="row-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Row title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="row-text">Description</Label>
          <Textarea
            id="row-text"
            value={titleText}
            onChange={(event) => setTitleText(event.target.value)}
            placeholder="Optional text shown under the row title"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <LazySelect
            id="row-image"
            label="Image"
            value={image}
            onValueChange={setImage}
            items={imageItems}
            placeholder="Select an image"
            searchable
            renderValue={(value) => {
              if (value === "__custom__") return "Custom URL / data…";
              return (app?.images ?? []).find((img) => img.id === value)?.name || value;
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="row-template">Template</Label>
            <Select value={String(template)} onValueChange={(value) => setTemplate(Number(value))}>
              <SelectTrigger id="row-template" className="w-full">
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="row-allowed">Max selections (0 = any)</Label>
            <Input
              id="row-allowed"
              type="number"
              min={0}
              value={allowedChoices}
              onChange={(event) => setAllowedChoices(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="row-width">Object width</Label>
            <Input
              id="row-width"
              value={objectWidth}
              onChange={(event) => setObjectWidth(event.target.value)}
              placeholder="col-md-3"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Row kind</Label>
          <RadioGroup
            value={rowKind}
            onValueChange={(value) => setRowKind(value as RowKind)}
            className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
          >
            {ROW_KINDS.map((kind) => (
              <label
                key={kind.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50"
              >
                <RadioGroupItem value={kind.value} />
                <span className="min-w-0 truncate">{kind.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>

        {(rowKind === "result" || rowKind === "group") && (
          <div className="space-y-2">
            <Label htmlFor="row-result-group">Result group id</Label>
            <Input
              id="row-result-group"
              value={resultGroupId}
              onChange={(event) => setResultGroupId(event.target.value)}
              placeholder="Group id, or empty for all rows"
            />
            <p className="text-xs text-muted-foreground">
              Limits which choices appear in this row to a group's members.
            </p>
          </div>
        )}

        {rowKind === "button" && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <Label>Button config</Label>
            <div className="space-y-2">
              <Label htmlFor="row-button-text">Button text</Label>
              <Input
                id="row-button-text"
                value={buttonText}
                onChange={(event) => setButtonText(event.target.value)}
                placeholder="Click"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="row-button-type">Button type</Label>
              <Select value={buttonTypeRadio} onValueChange={setButtonTypeRadio}>
                <SelectTrigger id="row-button-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="choiceselect">Choice select (variable / random)</SelectItem>
                  <SelectItem value="sumaddon">Point type sum addon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {buttonTypeRadio === "sumaddon" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="row-button-point-type">Point type</Label>
                  <Select value={pointTypeRandom} onValueChange={setPointTypeRandom}>
                    <SelectTrigger id="row-button-point-type" className="w-full">
                      <SelectValue placeholder="Select a point type" />
                    </SelectTrigger>
                    <SelectContent>
                      {pointTypeOptions.map((pointType) => (
                        <SelectItem key={pointType.id} value={pointType.id}>
                          {pointType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="row-button-random-min">Random min</Label>
                    <Input
                      id="row-button-random-min"
                      type="number"
                      value={randomMin}
                      onChange={(event) => setRandomMin(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="row-button-random-max">Random max</Label>
                    <Input
                      id="row-button-random-max"
                      type="number"
                      value={randomMax}
                      onChange={(event) => setRandomMax(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {!buttonRandom ? (
                  <div className="space-y-2">
                    <Label htmlFor="row-button-id">Variable id</Label>
                    <Input
                      id="row-button-id"
                      value={buttonId}
                      onChange={(event) => setButtonId(event.target.value)}
                      placeholder="var-1"
                    />
                  </div>
                ) : null}
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={buttonRandom}
                    onCheckedChange={(checked) => setButtonRandom(checked === true)}
                  />
                  Random select
                </label>
                {buttonRandom ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="row-button-random-number">Number of random choices</Label>
                      <Input
                        id="row-button-random-number"
                        type="number"
                        min={0}
                        value={buttonRandomNumber}
                        onChange={(event) => setButtonRandomNumber(event.target.value)}
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={isWeightedRandom}
                        onCheckedChange={(checked) => setIsWeightedRandom(checked === true)}
                      />
                      Weighted random
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={onlyUnselectedChoices}
                        onCheckedChange={(checked) => setOnlyUnselectedChoices(checked === true)}
                      />
                      Only unselected choices
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={allowActivateUnselectable}
                        onCheckedChange={(checked) =>
                          setAllowActivateUnselectable(checked === true)
                        }
                      />
                      Can activate unselectable choices
                    </label>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Row options</Label>
          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={width} onCheckedChange={(checked) => setWidth(checked === true)} />
              Half of the screen
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={deselectChoices}
                onCheckedChange={(checked) => setDeselectChoices(checked === true)}
              />
              Deselect choices if the row doesn't meet requirements
            </label>
          </div>
          <div className="space-y-2 pt-1">
            <Label htmlFor="row-justify">Choices justify</Label>
            <Select value={rowJustify} onValueChange={setRowJustify}>
              <SelectTrigger id="row-justify" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROW_JUSTIFIES.map((justify) => (
                  <SelectItem key={justify} value={justify}>
                    {justify}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            When the row's requirements are unmet, the whole row is hidden from the viewer.
          </p>
        </div>

        <div className="space-y-3 rounded-md border border-border p-3">
          <Label>Requirements</Label>
          <RequirementListEditor
            requireds={requireds}
            onChange={setRequireds}
            choices={choices}
            pointTypes={pointTypeOptions}
            globalRequirements={globalRequirementOptions}
          />
        </div>
      </div>
    </EditorPane>
  );
});

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
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
import { createDefaultRequireds } from "@shared/cyoa";
import type { Requireds } from "@shared/types";

import { LazySelect } from "./LazySelect";

interface RequirementListEditorProps {
  requireds: Requireds[];
  onChange: (next: Requireds[]) => void;
  choices: { id: string; label: string }[];
  pointTypes: { id: string; name: string }[];
  globalRequirements: { id: string; name: string }[];
}

/** Point threshold operators used by the viewer's `checkReq` (1 >, 2 ≥, 3 =, 4 ≤, 5 <, 6 ≠). */
const POINT_OPERATORS: { value: string; label: string }[] = [
  { value: "1", label: ">" },
  { value: "2", label: "≥" },
  { value: "3", label: "=" },
  { value: "4", label: "≤" },
  { value: "5", label: "<" },
  { value: "6", label: "≠" },
];

/**
 * Controlled editor for a `Requireds[]` array (on a row, choice, or addon).
 * Only the three most common requirement types are exposed: "id" (choice
 * selected / not selected), "points" (point threshold), and "gid" (global
 * requirement).
 */
export function RequirementListEditor({
  requireds,
  onChange,
  choices,
  pointTypes,
  globalRequirements,
}: RequirementListEditorProps) {
  function update(index: number, patch: Partial<Requireds>) {
    onChange(requireds.map((req, i) => (i === index ? { ...req, ...patch } : req)));
  }

  function remove(index: number) {
    onChange(requireds.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...requireds, createDefaultRequireds()]);
  }

  // The choice picker holds every choice in the project (1,000+), so it
  // renders lazily and searchably — mounting thousands of SelectItems per
  // requirement made opening any editor take seconds.
  const choiceItems = useMemo(
    () => choices.map((choice) => ({ value: choice.id, label: choice.label, searchText: choice.label })),
    [choices],
  );
  const pointTypeItems = useMemo(
    () => pointTypes.map((pointType) => ({ value: pointType.id, label: pointType.name })),
    [pointTypes],
  );
  const globalRequirementItems = useMemo(
    () =>
      globalRequirements.map((requirement) => ({
        value: requirement.id,
        label: requirement.name,
      })),
    [globalRequirements],
  );

  return (
    <div className="space-y-3">
      {requireds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No requirements yet. Add one below to gate this on another choice, a point threshold, or a
          global requirement.
        </p>
      ) : (
        requireds.map((req, index) => {
          const key = `${req.id ?? "req"}-${index}`;
          return (
            <div key={key} className="space-y-3 rounded-md border border-border p-3">
              <div className="flex items-end gap-2">
                <div className="min-w-40 flex-1 space-y-1">
                  <Label>Type</Label>
                  <Select value={req.type} onValueChange={(type) => update(index, { type })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Requirement type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">Choice selected</SelectItem>
                      <SelectItem value="points">Point threshold</SelectItem>
                      <SelectItem value="gid">Global requirement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                >
                  Remove
                </Button>
              </div>

              {req.type === "id" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-44 flex-1 space-y-1">
                    <Label>Choice</Label>
                    <LazySelect
                      value={req.reqId ?? ""}
                      onValueChange={(reqId) => update(index, { reqId })}
                      items={choiceItems}
                      placeholder="Select a choice"
                      searchable
                      renderValue={(reqId) => choices.find((choice) => choice.id === reqId)?.label ?? reqId}
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
                    <Checkbox
                      checked={!req.required}
                      onCheckedChange={(checked) =>
                        update(index, { required: !(checked === true) })
                      }
                    />
                    Not selected
                  </label>
                </div>
              ) : req.type === "points" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1 space-y-1">
                    <Label>Point type</Label>
                    <LazySelect
                      value={req.reqId ?? ""}
                      onValueChange={(reqId) => update(index, { reqId })}
                      items={pointTypeItems}
                      placeholder="Select a point type"
                      renderValue={(reqId) =>
                        pointTypes.find((pointType) => pointType.id === reqId)?.name ?? reqId
                      }
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    <Label>Operator</Label>
                    <Select
                      value={req.operator ?? "1"}
                      onValueChange={(operator) => update(index, { operator })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POINT_OPERATORS.map((operator) => (
                          <SelectItem key={operator.value} value={operator.value}>
                            {operator.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label>Value</Label>
                    <Input
                      type="number"
                      value={String(req.reqPoints ?? 0)}
                      onChange={(event) =>
                        update(index, { reqPoints: Number(event.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              ) : req.type === "gid" ? (
                <div className="space-y-1">
                  <Label>Global requirement</Label>
                  <LazySelect
                    value={req.reqId ?? ""}
                    onValueChange={(reqId) => update(index, { reqId })}
                    items={globalRequirementItems}
                    placeholder="Select a global requirement"
                    renderValue={(reqId) =>
                      globalRequirements.find((requirement) => requirement.id === reqId)?.name ??
                      reqId
                    }
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Text before</Label>
                  <Input
                    value={req.beforeText ?? ""}
                    onChange={(event) => update(index, { beforeText: event.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Text after</Label>
                  <Input
                    value={req.afterText ?? ""}
                    onChange={(event) => update(index, { afterText: event.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={req.hideRequired ?? false}
                  onCheckedChange={(checked) => update(index, { hideRequired: checked === true })}
                />
                Hide when met
              </label>
            </div>
          );
        })
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        Add requirement
      </Button>
    </div>
  );
}

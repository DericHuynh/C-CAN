import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";

export function BuildFormDialog({
  open,
  onOpenChange,
  cyoa,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cyoa: UseCyoaResult;
}) {
  const [importText, setImportText] = useState("");
  const titles = useMemo(() => {
    const out: string[] = [];
    for (const [id, entry] of cyoa.state.activated) {
      if (entry.isRowButton || entry.isVariable) continue;
      const cMap = cyoa.idx.choiceMap.get(id);
      if (!cMap) continue;
      const label = cMap.choice.title || id;
      out.push(entry.multiple > 0 ? `${label} (x${entry.multiple})` : label);
    }
    return out;
  }, [cyoa.state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setImportText("");
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Build form</DialogTitle>
          <DialogDescription>
            Selected choices and their build code. Import a code to restore a build.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Selected choices</Label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-sm">
              {titles.length === 0 ? (
                <p className="text-muted-foreground">Nothing selected.</p>
              ) : (
                <ul className="list-disc space-y-0.5 pl-5">
                  {titles.map((title, i) => (
                    <li key={i}>{title}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="build-code">Build code</Label>
            <Textarea
              id="build-code"
              readOnly
              value={cyoa.buildCode}
              rows={3}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="build-import">Import (paste a build code)</Label>
            <Textarea
              id="build-import"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="choice_id,other_id/ON#2,…"
              rows={3}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              cyoa.importBuildCode(importText);
              toast.success("Build imported");
            }}
          >
            Import build
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Save / load slots                                                  */
/* ------------------------------------------------------------------ */

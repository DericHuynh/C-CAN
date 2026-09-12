import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { IconDownload, IconUpload } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BUILD_SLOT_NAMES, type UseCyoaResult } from "@/features/viewer/use-cyoa";

export function SaveLoadDialog({
  open,
  onOpenChange,
  cyoa,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cyoa: UseCyoaResult;
}) {
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<
    Array<{ slot: string } & import("@/features/viewer/use-cyoa").BuildSlot>
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setSlots(cyoa.listSlots());
  }, [open, cyoa]);

  function downloadBuild() {
    const blob = new Blob([cyoa.buildCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "build.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      if (!text.trim()) {
        toast.error("The file is empty");
        return;
      }
      cyoa.importBuildCode(text);
      toast.success("Build loaded");
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  const pageSlots = BUILD_SLOT_NAMES.slice(page * 9, page * 9 + 9);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setName("");
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save / load build</DialogTitle>
          <DialogDescription>
            99 named slots per page. Slots persist in this browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadBuild}>
              <IconDownload className="mr-1.5 size-4" />
              Download build (.txt)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconUpload className="mr-1.5 size-4" />
              Upload build
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,text/plain"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="slot-name">Slot name</Label>
              <Input
                id="slot-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My build"
              />
            </div>
            <p className="text-xs text-muted-foreground">Name applies to the next Save.</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {pageSlots.map((slot, index) => {
              const data = slots.find((s) => s.slot === slot);
              return (
                <div key={slot} className="flex flex-col gap-1 rounded-md border border-border p-2">
                  <span className="truncate text-xs font-medium">
                    {data?.name || `Slot ${page * 9 + index + 1}`}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {data ? new Date(data.updatedAt).toLocaleString() : "Empty"}
                  </span>
                  <div className="mt-1 flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 px-1 text-[10px]"
                      onClick={() => {
                        const saved = cyoa.saveSlot(
                          slot,
                          name.trim() || data?.name || `Slot ${page * 9 + index + 1}`,
                        );
                        if (!saved) return;
                        setSlots(cyoa.listSlots());
                        setName("");
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 flex-1 px-1 text-[10px]"
                      disabled={!data}
                      onClick={() => {
                        const code = cyoa.loadSlot(slot);
                        if (code != null) {
                          cyoa.importBuildCode(code);
                          toast.success("Build loaded");
                        }
                      }}
                    >
                      Load
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                      disabled={!data}
                      onClick={() => {
                        cyoa.deleteSlot(slot);
                        setSlots(cyoa.listSlots());
                      }}
                    >
                      Del
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1} of 11</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 10}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

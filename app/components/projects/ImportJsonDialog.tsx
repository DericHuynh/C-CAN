import { useRef, useState } from "react";
import { useNavigate } from "react-router";
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
import { extractProjectId, useImportProjectJson } from "@/hooks/use-projects";

import { inlineZipImages, unzip } from "@/lib/zip";

interface ImportJsonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseDocument(raw: string): unknown {
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The imported JSON must be a CYOA document object.");
  }
  return parsed;
}

/**
 * Dialog for importing a CYOA document. Supports pasting JSON text or
 * uploading a `.json` / `.zip` file — the same file formats the original
 * ICCPlus editor writes ("Save to Disk" → `project.json`, the zip export
 * bundles `project.json` + `images/…` which are inlined as data URLs, exactly
 * like the original `loadFromDisk`).
 */
export function ImportJsonDialog({
  open,
  onOpenChange,
}: ImportJsonDialogProps) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const importProject = useImportProjectJson();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function importDoc(json: string | object) {
    importProject.mutate(
      { json },
      {
        onSuccess: (data) => {
          toast.success("Project imported");
          onOpenChange(false);
          setJsonText("");
          const id = extractProjectId(data);
          if (id) {
            navigate(`/projects/${encodeURIComponent(id)}`);
          }
        },
        onError: (err) => {
          setError(
            err instanceof Error ? err.message : "Import failed. Please try again.",
          );
        },
      },
    );
  }

  function handleImport() {
    setError(null);
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setError("Paste a CYOA JSON document or upload a .json/.zip file to import.");
      return;
    }

    try {
      importDoc(parseDocument(trimmed) as string | object);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The pasted text is not valid JSON.");
    }
  }

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".zip")) {
        const files = await unzip(await file.arrayBuffer());
        const jsonEntry = [...files.entries()].find(([name]) => name.endsWith(".json"));
        if (!jsonEntry) throw new Error("The zip does not contain a project.json file.");
        const [name, bytes] = jsonEntry;
        const doc = parseDocument(new TextDecoder().decode(bytes)) as Record<string, unknown>;
        inlineZipImages(doc, files);
        toast.success(`Imported from ${name}`);
        importDoc(doc);
      } else if (lower.endsWith(".json")) {
        importDoc(parseDocument(await file.text()) as string | object);
      } else {
        setError("Unsupported file type. Use a .json or .zip file exported from ICCPlus.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read the file.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setError(null);
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import CYOA JSON</DialogTitle>
          <DialogDescription>
            Upload a project.json or .zip exported from the ICCPlus editor, or
            paste a CYOA document to create a new project from it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="import-json-file">File (.json or .zip)</Label>
          <input
            id="import-json-file"
            ref={fileInputRef}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          <div className="flex items-center gap-2 py-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or paste</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Label htmlFor="import-json">JSON document</Label>
          <Textarea
            id="import-json"
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            placeholder={'{\n  "version": "2.9.29",\n  "rows": [],\n  ...\n}'}
            rows={10}
            className="font-mono text-xs leading-5"
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={busy || importProject.isPending || jsonText.trim().length === 0}
          >
            {busy || importProject.isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

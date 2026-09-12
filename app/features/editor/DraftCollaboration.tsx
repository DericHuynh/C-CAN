import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function createDraftRegistry() {
  const conflicts = new Map<
    string,
    { resolve: (keep: boolean) => void; latest: unknown; draft: unknown }
  >();
  let revision = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    revision++;
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    count: () => conflicts.size,
    version: () => revision,
    entries: () => [...conflicts.entries()],
    set: (id: string, resolve: (keep: boolean) => void, latest: unknown, draft: unknown) => {
      conflicts.set(id, { resolve, latest, draft });
      emit();
    },
    delete: (id: string) => {
      if (conflicts.delete(id)) emit();
    },
    resolve: (keep: boolean) => {
      [...conflicts.values()].forEach(({ resolve }) => resolve(keep));
      conflicts.clear();
      emit();
    },
    assertReady: () => {
      if (conflicts.size)
        throw new Error(
          "Review the conflicting shared changes before saving. Your draft is still available.",
        );
    },
  };
}
const Context = createContext<ReturnType<typeof createDraftRegistry> | null>(null);
export const useDraftRegistry = () => useContext(Context);

export function DraftCollaborationProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(createDraftRegistry, []);
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}

export function DraftConflictNotice() {
  const registry = useDraftRegistry();
  useSyncExternalStore(registry!.subscribe, registry!.version, () => 0);
  const count = registry!.count();
  if (!count) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/50 bg-card p-3 text-sm"
    >
      <p className="min-w-0 flex-1">
        Shared changes overlap your draft in {count} field{count === 1 ? "" : "s"}. Review them
        before saving.
      </p>
      <Button variant="outline" size="sm" onClick={() => registry!.resolve(false)}>
        Use latest values
      </Button>
      <Button variant="outline" size="sm" onClick={() => registry!.resolve(true)}>
        Keep my edits
      </Button>
      <details className="basis-full">
        <summary className="cursor-pointer">Review conflicting values</summary>
        <div className="mt-2 max-h-64 space-y-3 overflow-auto">
          {registry!.entries().map(([id, entry]) => (
            <div key={id} className="grid gap-2 sm:grid-cols-2">
              <div>
                <strong>Your draft</strong>
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {previewValue(entry.draft)}
                </pre>
              </div>
              <div>
                <strong>Latest saved</strong>
                <pre className="whitespace-pre-wrap break-words text-xs">
                  {previewValue(entry.latest)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function previewValue(value: unknown) {
  const text = typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "(empty)");
  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
}

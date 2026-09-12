import { useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

/**
 * One-click copy chip for entity ids. Clicking copies the id to the clipboard
 * and flashes a checkmark. Falls back to a hidden-textarea copy for
 * non-secure contexts (the app can run on plain http locally).
 */
export function CopyId({ id, className }: { id: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = id;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // clipboard unavailable — nothing more we can do
      }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${id}`}
      aria-label={`Copy ${id}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground hover:bg-accent",
        className,
      )}
    >
      {copied ? (
        <IconCheck className="size-3 shrink-0 text-emerald-500" />
      ) : (
        <IconCopy className="size-3 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{id}</span>
    </button>
  );
}

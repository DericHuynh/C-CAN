import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Detail-pane chrome for the master/detail editors: a sticky card with a
 * title, the editor form, and Cancel / Save actions in the footer.
 *
 * The card sticks to the top of its column on wide screens and scrolls
 * internally so long forms (e.g. the choice editor's accordion) never push
 * the master list off the page.
 */
export function EditorPane({
  title,
  description,
  children,
  busy,
  saveLabel = "Save",
  canSave = true,
  onCancel,
  onSave,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  busy?: boolean;
  saveLabel?: string;
  canSave?: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Card className="lg:sticky lg:top-0 lg:max-h-[calc(100dvh-180px)] lg:overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      <CardFooter className="justify-end gap-2 border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave} disabled={busy || !canSave}>
          {saveLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}

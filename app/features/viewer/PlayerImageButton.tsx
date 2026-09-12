import { useT } from "@agent-native/core/client/i18n";
import { Button } from "@/components/ui/button";

export function PlayerImageButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {t("viewer.uploadImage")}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Visual-editor toolbar (V-Editor)                                   */
/* ------------------------------------------------------------------ */

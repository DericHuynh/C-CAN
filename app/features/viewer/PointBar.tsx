import { useState } from "react";
import { IconBackpack, IconMenu2 } from "@tabler/icons-react";
import { useT } from "@agent-native/core/client/i18n";
import { Button } from "@/components/ui/button";
import { type UseCyoaResult } from "@/features/viewer/use-cyoa";
import { cn } from "@/lib/utils";
import { checkPointEnable, pointBarOverrides } from "@shared/cyoa-engine";
import type { App } from "@shared/types";
import { resolveImageRef } from "@shared/cyoa";
import { formatPointValue, numValue } from "./cyoa-styles";
import { ViewerImage } from "./ViewerImage";

interface PointBarProps {
  app: App;
  cyoa: UseCyoaResult;
  /** Visual-editor mode: show totals only, no play actions. */
  editing?: boolean;
  onReview?: () => void;
  showPoints?: boolean;
  onExitFullscreen?: () => void;
  showBackpackBtn: boolean;
  onOpenBackpack: () => void;
  onOpenSearch: () => void;
  onOpenBuild: () => void;
  onOpenSave: () => void;
  onOpenSettings: () => void;
  onClean: () => void;
}

export function PointBar({
  app,
  cyoa,
  editing = false,
  onReview,
  showPoints = true,
  onExitFullscreen,
  showBackpackBtn,
  onOpenBackpack,
  onOpenSearch,
  onOpenBuild,
  onOpenSave,
  onOpenSettings,
  onClean,
}: PointBarProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const styling = (cyoa.idx.app.styling ?? {}) as Record<string, unknown>;
  // Action/point bar always docks to the bottom of the viewport (the original
  // ICCPlus viewer's bottom bar).
  const barOverrides = pointBarOverrides(cyoa.idx, cyoa.state);
  const str = (key: string): string =>
    typeof styling[key] === "string" ? (styling[key] as string) : "";
  const num = (key: string, fallback = 0): number => numValue(styling[key], fallback);

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 px-4 py-2.5 lg:px-6",
        onExitFullscreen && "mt-auto shrink-0",
      )}
      style={{
        backgroundColor: barOverrides.bgColor ?? (str("barBackgroundColor") || undefined),
        color: barOverrides.textColor ?? (str("barTextColor") || undefined),
      }}
    >
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center">
        <div className="col-start-2 flex min-w-0 flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          {(showPoints ? (app.pointTypes ?? []) : [])
            .filter((pt) => checkPointEnable(pt, cyoa.idx, cyoa.state))
            .map((pointType) => {
              const total =
                cyoa.totals.get(pointType.id)?.total ?? Number(pointType.startingSum ?? 0);
              const isNegative = total < 0;
              // The original colors the sum by the SIGN of the current total
              // (barPointPos for >= 0, barPointNeg otherwise), not by a
              // comparison to the starting value.
              const valueColor =
                (isNegative ? str("barPointNeg") : str("barPointPos")) || undefined;
              const privateColor =
                pointType.pointPrivateColorIsOn &&
                (isNegative ? pointType.privateNegativeColor : pointType.privateColor)
                  ? isNegative
                    ? pointType.privateNegativeColor
                    : pointType.privateColor
                  : undefined;
              const icon = pointType.iconIsOn
                ? isNegative && pointType.negativeIconIsOn
                  ? {
                      src: resolveImageRef(app, pointType.negativeImage),
                      w: numValue(pointType.negativeIconWidth, 0),
                      h: numValue(pointType.negativeIconHeight, 0),
                      onSide: pointType.negativeImageOnSide === true,
                      sidePlacement: pointType.negativeImageSidePlacement === true,
                    }
                  : {
                      src: resolveImageRef(app, pointType.image),
                      w: numValue(pointType.iconWidth, 0),
                      h: numValue(pointType.iconHeight, 0),
                      onSide: pointType.imageOnSide === true,
                      sidePlacement: pointType.imageSidePlacement === true,
                    }
                : null;
              return (
                <div
                  key={pointType.id}
                  className="flex min-w-0 max-w-full flex-wrap items-baseline justify-center gap-1.5 text-sm"
                  style={{
                    margin: num("barTextMargin", 0),
                    padding: num("barTextPadding", 0),
                    fontFamily: str("barTextFont") || undefined,
                    fontSize: num("barTextSize", 0) || undefined,
                    color: privateColor || undefined,
                  }}
                >
                  {icon && !icon.onSide && !icon.sidePlacement && icon.src ? (
                    <ViewerImage
                      src={icon.src}
                      alt=""
                      className="self-center"
                      style={{ width: icon.w, height: icon.h }}
                    />
                  ) : null}
                  {pointType.beforeText ? (
                    <span className="font-medium text-foreground">{pointType.beforeText}</span>
                  ) : null}
                  {icon && icon.onSide && !icon.sidePlacement && icon.src ? (
                    <ViewerImage
                      src={icon.src}
                      alt=""
                      className="self-center"
                      style={{ width: icon.w, height: icon.h }}
                    />
                  ) : null}
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: barOverrides.iconColor ?? valueColor }}
                  >
                    {formatPointValue(pointType, total)}
                  </span>
                  {icon && !icon.onSide && icon.sidePlacement && icon.src ? (
                    <ViewerImage
                      src={icon.src}
                      alt=""
                      className="self-center"
                      style={{ width: icon.w, height: icon.h }}
                    />
                  ) : null}
                  {pointType.afterText ? (
                    <span className="text-muted-foreground">{pointType.afterText}</span>
                  ) : null}
                  {icon && icon.onSide && icon.sidePlacement && icon.src ? (
                    <ViewerImage
                      src={icon.src}
                      alt=""
                      className="self-center"
                      style={{ width: icon.w, height: icon.h }}
                    />
                  ) : null}
                </div>
              );
            })}
        </div>

        <div className="relative col-start-3 flex items-center justify-end gap-1.5">
          {!editing ? (
            <>
              {showBackpackBtn ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={onOpenBackpack}
                  title="Backpack"
                  aria-label="Backpack"
                >
                  <IconBackpack className="size-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setMenuOpen((v) => !v)}
                title="Menu"
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                <IconMenu2 className="size-4" />
              </Button>
              {menuOpen ? (
                <div className="absolute bottom-full right-0 z-30 mb-1 w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                  {onReview && (
                    <MenuButton
                      label={t("viewerFeedback.review")}
                      onClick={() => {
                        setMenuOpen(false);
                        onReview();
                      }}
                    />
                  )}
                  <MenuButton
                    label="Clear selected choices"
                    onClick={() => {
                      onClean();
                      setMenuOpen(false);
                    }}
                  />
                  {app.enableSearch ? (
                    <MenuButton
                      label="Search choice"
                      onClick={() => {
                        onOpenSearch();
                        setMenuOpen(false);
                      }}
                    />
                  ) : null}
                  <MenuButton
                    label="Build form"
                    onClick={() => {
                      onOpenBuild();
                      setMenuOpen(false);
                    }}
                  />
                  <MenuButton
                    label="Save / load build"
                    onClick={() => {
                      onOpenSave();
                      setMenuOpen(false);
                    }}
                  />
                  {onExitFullscreen && (
                    <MenuButton
                      label={t("publishing.exitFullscreen")}
                      onClick={() => {
                        setMenuOpen(false);
                        onExitFullscreen();
                      }}
                    />
                  )}
                  <ReaderSettingsButton
                    onClick={() => {
                      onOpenSettings();
                      setMenuOpen(false);
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
    >
      {label}
    </button>
  );
}

function ReaderSettingsButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return <MenuButton label={t("viewer.settings")} onClick={onClick} />;
}

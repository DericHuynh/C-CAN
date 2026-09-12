import type { ViewerTarget } from "@shared/viewer-feedback";
import { VIEWER_CAPTURE_MAX_BYTES } from "@shared/viewer-feedback";

/** Intersect the viewer with every clipping ancestor, not just the window. */
export function viewerViewport(root: HTMLElement) {
  const rect = root.getBoundingClientRect();
  let left = Math.max(0, rect.left),
    top = Math.max(0, rect.top);
  let right = Math.min(window.innerWidth, rect.right),
    bottom = Math.min(window.innerHeight, rect.bottom);
  for (let parent = root.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      left = Math.max(left, bounds.left);
      right = Math.min(right, bounds.right);
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      top = Math.max(top, bounds.top);
      bottom = Math.min(bottom, bounds.bottom);
    }
  }
  for (const controls of root.querySelectorAll<HTMLElement>("[data-viewer-controls]")) {
    const rect = controls.getBoundingClientRect();
    if (rect.top <= top + 1 && rect.bottom > top) top = Math.min(bottom, rect.bottom);
  }
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function intersects(
  a: Pick<DOMRect, "left" | "right" | "top" | "bottom">,
  b: Pick<DOMRect, "left" | "right" | "top" | "bottom">,
) {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

export function viewerTargetElement(root: HTMLElement, target: ViewerTarget) {
  const key = target.addonId ? "addon" : target.choiceId ? "choice" : "row";
  const id = target.addonId || target.choiceId || target.rowId;
  // Compare attributes directly: imported IDs can contain any CSS metacharacters.
  return id
    ? ([...root.querySelectorAll<HTMLElement>(`[data-cyoa-${key}]`)].find(
        (element) => element.getAttribute(`data-cyoa-${key}`) === id,
      ) ?? null)
    : null;
}

export function focusViewerTarget(root: HTMLElement, target: ViewerTarget): boolean {
  const element = viewerTargetElement(root, target);
  if (!element || !element.getClientRects().length || getComputedStyle(element).display === "none")
    return false;
  // Selecting text for inline editing also updates the URL target. Keep that
  // navigation (and saved-document refreshes) from blurring the editor, which
  // commits its draft. Check the mounted editor even before its focus frame runs.
  if (element.querySelector('[contenteditable="true"]')) return true;
  // "instant" prevents captures racing a smooth animation. No clicks or build changes.
  const rowTarget = !target.choiceId && !target.addonId;
  element.style.scrollMarginTop = `${(root.querySelector("[data-viewer-controls]")?.getBoundingClientRect().height ?? 48) + 8}px`;
  element.scrollIntoView({
    behavior: "instant",
    block: rowTarget ? "start" : "center",
    inline: "nearest",
  });
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
  element.animate?.(
    [
      { outline: "3px solid #38bdf8", outlineOffset: "4px" },
      { outline: "3px solid transparent", outlineOffset: "4px" },
    ],
    { duration: 1800 },
  );
  return true;
}

/** A bounded DOM-rendered picture of the viewer only. Chat/inspector stay out. */
export async function captureViewerViewport(root: HTMLElement) {
  const { toCanvas } = await import("html-to-image");
  await Promise.race([document.fonts?.ready, new Promise((resolve) => setTimeout(resolve, 2000))]);
  const clip = viewerViewport(root);
  if (clip.width < 1 || clip.height < 1)
    throw new Error("The viewer is offscreen. Scroll it into view first.");
  const warnings: string[] = [];
  const bounds = root.getBoundingClientRect();
  const originalScrollTop = root.scrollTop;
  const originalScrollLeft = root.scrollLeft;
  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    overflow: "hidden",
    width: `${clip.width}px`,
    height: `${clip.height}px`,
    pointerEvents: "none",
    background: getComputedStyle(root).backgroundColor,
  });
  wrapper.setAttribute("aria-hidden", "true");
  let nodes = 0;
  function cloneVisible(node: Node): Node {
    if (++nodes > 12000)
      throw new Error(
        "This view is too complex to capture. Zoom in or navigate to a smaller section.",
      );
    if (!(node instanceof Element)) return node.cloneNode(false);
    const rect = node.getBoundingClientRect();
    const clone = node.cloneNode(false) as HTMLElement;
    const style = getComputedStyle(node);
    if (clone.style)
      for (const property of style)
        clone.style.setProperty(property, style.getPropertyValue(property));
    // Preserve offscreen layout with empty boxes, avoiding thousands of image fetches.
    if (node !== root && (!intersects(rect, clip) || node.hasAttribute("data-viewer-controls"))) {
      const spacer = document.createElement("div");
      spacer.style.cssText = clone.style?.cssText ?? "";
      Object.assign(spacer.style, {
        visibility: "hidden",
        backgroundImage: "none",
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        minHeight: `${rect.height}px`,
      });
      return spacer;
    }
    if (node.matches("iframe,video,canvas")) {
      warnings.push(
        "Embedded video, canvas, and iframe content cannot be captured by the viewer renderer.",
      );
      const placeholder = document.createElement("div");
      placeholder.style.cssText = clone.style?.cssText ?? "";
      placeholder.textContent = "[Embedded media]";
      return placeholder;
    }
    if (node instanceof HTMLImageElement && (!node.complete || !node.naturalWidth))
      warnings.push("Some images are still loading or failed to load.");
    if (clone.style && (style.position === "sticky" || style.position === "fixed")) {
      // Freeze sticky bars at their actual position in the captured viewport.
      Object.assign(clone.style, {
        position: "absolute",
        top: `${rect.top - bounds.top + root.scrollTop}px`,
        left: `${rect.left - bounds.left}px`,
        bottom: "auto",
        right: "auto",
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }
    for (const child of node.childNodes) clone.appendChild(cloneVisible(child));
    return clone;
  }
  const clone = cloneVisible(root) as HTMLElement;
  Object.assign(clone.style, {
    position: "absolute",
    margin: "0",
    overflow: "visible",
    maxHeight: "none",
    width: `${bounds.width}px`,
    height: `${root.scrollHeight}px`,
    left: `${bounds.left - clip.left - root.scrollLeft}px`,
    top: `${bounds.top - clip.top - root.scrollTop}px`,
  });
  wrapper.append(clone);
  root.parentElement!.append(wrapper);
  try {
    const scale = Math.min(1, 1600 / clip.width, 1200 / clip.height);
    const canvas = await toCanvas(wrapper, {
      width: clip.width,
      height: clip.height,
      pixelRatio: scale,
      // Chromium exposes both physical and logical insets. Reset both so
      // html-to-image does not retain the offscreen staging position.
      style: { position: "relative", left: "0", top: "0", insetInline: "0", insetBlock: "0" },
      backgroundColor: "#202020",
      preferredFontFormat: "woff2",
      onImageErrorHandler: () => {
        warnings.push(
          "Some remote images could not be embedded in this capture (network or CORS).",
        );
      },
    });
    const current = viewerViewport(root);
    if (
      !root.isConnected ||
      root.scrollTop !== originalScrollTop ||
      root.scrollLeft !== originalScrollLeft ||
      Math.abs(root.getBoundingClientRect().top - bounds.top) > 1 ||
      Math.abs(current.width - clip.width) > 1 ||
      Math.abs(current.height - clip.height) > 1
    )
      throw new Error("The viewer moved during capture. Request a fresh screenshot.");
    let dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (dataUrl.length * 0.75 > VIEWER_CAPTURE_MAX_BYTES)
      dataUrl = canvas.toDataURL("image/jpeg", 0.55);
    const blob = await (await fetch(dataUrl)).blob();
    if (blob.size > VIEWER_CAPTURE_MAX_BYTES)
      throw new Error("The screenshot is too large. Use a smaller viewer area.");
    return {
      blob,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      warnings: [...new Set(warnings)].slice(0, 8),
    };
  } finally {
    wrapper.remove();
  }
}

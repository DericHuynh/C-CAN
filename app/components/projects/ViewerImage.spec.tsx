// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ImagePreviewProvider, ViewerImage } from "./ViewerImage";

let root: Root;
let container: HTMLDivElement;
let intersect: IntersectionObserverCallback;
const requests: FakeImage[] = [];
class FakeImage {
  src = "";
  decoding = "";
  onload: (() => Promise<void>) | null = null;
  decode = vi.fn(async () => {});
  removeAttribute = vi.fn();
  constructor() {
    requests.push(this);
  }
}
const sources = ["https://example.com/base.webp", "https://example.com/variant.webp"];
const previews = sources.map((source, i) => ({
  source,
  data: `data:image/webp;base64,${i ? "BBBB" : "AAAA"}`,
  width: 900,
  height: 600,
}));
function render(index = 0, withPreview = true) {
  act(() =>
    root.render(
      <ImagePreviewProvider
        images={sources.map((image, i) => ({
          id: String(i),
          image,
          preview: withPreview ? previews[i] : undefined,
        }))}
      >
        <ViewerImage src={sources[index]} alt="Portrait" className="w-full" />
      </ImagePreviewProvider>,
    ),
  );
}
function enter() {
  act(() =>
    intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
  );
}
beforeEach(() => {
  requests.length = 0;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("viewer image LOD", () => {
  it("shows the embedded preview immediately and waits until nearby before downloading", async () => {
    render();
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe(previews[0].data);
    expect(img.style.aspectRatio).toBe("900 / 600");
    expect(requests).toHaveLength(0);
    enter();
    expect(requests[0].src).toBe(sources[0]);
    expect(img.getAttribute("src")).toBe(previews[0].data);
    await act(async () => {
      await requests[0].onload!();
    });
    expect(requests[0].decode).toHaveBeenCalledOnce();
    expect(img.getAttribute("src")).toBe(sources[0]);
    expect(img.getAttribute("alt")).toBe("Portrait");
  });
  it("keeps the current variant's preview when an obsolete download finishes", async () => {
    render();
    enter();
    let decode!: () => void;
    requests[0].decode.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          decode = resolve;
        }),
    );
    const oldLoad = requests[0].onload!();
    render(1);
    await act(async () => {
      decode();
      await oldLoad;
    });
    expect(container.querySelector("img")!.getAttribute("src")).toBe(previews[1].data);
    await act(async () => {
      await requests[requests.length - 1].onload!();
    });
    expect(container.querySelector("img")!.getAttribute("src")).toBe(sources[1]);
  });
  it("retains the preview after decoding fails", async () => {
    render();
    enter();
    requests[0].decode.mockRejectedValue(new Error("Bad image"));
    await act(async () => {
      await requests[0].onload!();
    });
    expect(container.querySelector("img")!.getAttribute("src")).toBe(previews[0].data);
  });
  it("uses native lazy loading for older resources without previews", () => {
    render(0, false);
    expect(container.querySelector("img")!.getAttribute("src")).toBe(sources[0]);
    expect(container.querySelector("img")!.getAttribute("loading")).toBe("lazy");
    expect(requests).toHaveLength(0);
  });
  it("works when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render();
    expect(requests).toHaveLength(1);
    await act(async () => {
      await requests[0].onload!();
    });
    expect(container.querySelector("img")!.getAttribute("src")).toBe(sources[0]);
  });
});

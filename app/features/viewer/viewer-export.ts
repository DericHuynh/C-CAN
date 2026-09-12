/** Render the full backpack, including offscreen images, without changing play state. */
export async function exportBackpackImages(
  content: HTMLElement,
  singleFile = false,
): Promise<Blob[]> {
  const { toBlob } = await import("html-to-image");
  await document.fonts?.ready;
  const width = Math.max(1, Math.ceil(content.getBoundingClientRect().width));
  const clone = content.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.maxHeight = "none";
  const wrapper = document.createElement("div");
  wrapper.className = "cyoa-viewer";
  Object.assign(wrapper.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${width}px`,
    overflow: "hidden",
    pointerEvents: "none",
  });
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.append(clone);
  content.parentElement!.append(wrapper);
  try {
    await Promise.all(
      [...clone.querySelectorAll("img")].map(async (image) => {
        image.loading = "eager";
        image.src = image.dataset.imageSource || image.src;
        // Broken remote images should produce an export error, not hang the UI.
        await image.decode();
      }),
    );
    const height = Math.max(1, clone.scrollHeight);
    const maxHeight = Math.max(1, Math.min(16384, Math.floor(16_777_216 / width)));
    const partHeight = singleFile ? height : maxHeight;
    const scale = singleFile ? Math.min(1, 16384 / width, maxHeight / height) : 1;
    const images: Blob[] = [];
    for (let offset = 0; offset < height; offset += partHeight) {
      const currentHeight = Math.min(partHeight, height - offset);
      wrapper.style.height = `${currentHeight}px`;
      clone.style.transform = `translateY(-${offset}px)`;
      const blob = await toBlob(wrapper, {
        width,
        height: currentHeight,
        pixelRatio: scale,
        style: { position: "static", left: "0", top: "0" },
      });
      if (!blob) throw new Error("Backpack image could not be rendered.");
      images.push(blob);
    }
    return images;
  } finally {
    wrapper.remove();
  }
}

import Cropper, { DEFAULT_TEMPLATE } from "cropperjs";

/** Browser-only Cropper 2 adapter. Keep export sizes in source pixels, not preview pixels. */
export function createImageCropper(element: HTMLImageElement, position: number) {
  const cropper = new Cropper(element, {
    template: DEFAULT_TEMPLATE.replace('initial-coverage="0.5"', "precise").replace(
      "<cropper-image",
      '<cropper-image initial-fit="contain"',
    ),
  });
  const canvas = cropper.getCropperCanvas()!;
  const image = cropper.getCropperImage()!;
  const selection = cropper.getCropperSelection()!;
  canvas.style.height = "100%";
  let destroyed = false;
  let aspectRatio = NaN;

  function selectInitialArea() {
    const bounds = image.getBoundingClientRect();
    const container = canvas.getBoundingClientRect();
    let width = bounds.width * 0.8;
    let height = bounds.height * 0.8;
    if (aspectRatio > 0) {
      width = Math.min(width, height * aspectRatio);
      height = width / aspectRatio;
    }
    const cell = Math.max(0, Math.min(8, Math.round(position)));
    selection.$change(
      bounds.left - container.left + ((bounds.width - width) * (cell % 3)) / 2,
      bounds.top - container.top + ((bounds.height - height) * Math.floor(cell / 3)) / 2,
      width,
      height,
      aspectRatio,
    );
  }

  // Cropper 2 no longer has viewMode: keep selection gestures inside the image.
  selection.addEventListener("change", (event) => {
    const area = (event as CustomEvent<{ x: number; y: number; width: number; height: number }>)
      .detail;
    const bounds = image.getBoundingClientRect();
    const container = canvas.getBoundingClientRect();
    const x = bounds.left - container.left,
      y = bounds.top - container.top;
    if (
      area.x < x - 0.5 ||
      area.y < y - 0.5 ||
      area.x + area.width > x + bounds.width + 0.5 ||
      area.y + area.height > y + bounds.height + 0.5
    )
      event.preventDefault();
  });

  return {
    ready: image.$ready().then(async () => {
      if (destroyed) return;
      // Image-load and custom-element attribute callbacks both schedule initial
      // fitting. Wait until layout settles before measuring the source scale.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (destroyed) return;
      image.$resetTransform().$center("contain");
      await image.$nextTick();
      if (!destroyed) selectInitialArea();
    }),
    setAspectRatio(value: number) {
      aspectRatio = value;
      selection.aspectRatio = value;
      selectInitialArea();
    },
    rotate() {
      image.$rotate("90deg").$center("contain");
      selectInitialArea();
    },
    reset() {
      aspectRatio = NaN;
      selection.aspectRatio = NaN;
      image.$resetTransform().$center("contain");
      selectInitialArea();
    },
    async export(scale: number, quality: number) {
      const [a, b] = image.$getTransform();
      const zoom = Math.hypot(a, b);
      if (!(zoom > 0 && selection.width > 0 && selection.height > 0)) {
        throw new Error("Empty crop selection");
      }
      const factor = Math.min(scale / 100 / zoom, 8192 / selection.width, 8192 / selection.height);
      const width = Math.max(1, Math.round(selection.width * factor));
      const height = Math.max(1, Math.round(selection.height * factor));
      const output = await selection.$toCanvas({
        width,
        height,
        // Fractional DOM coordinates can make Cropper truncate a dimension
        // just below an integer. Set the requested pixel dimensions before draw.
        beforeDraw(_context, canvas) {
          canvas.width = width;
          canvas.height = height;
        },
      });
      return output.toDataURL("image/webp", quality / 100);
    },
    destroy() {
      destroyed = true;
      cropper.destroy();
    },
  };
}

export type ImageCropper = ReturnType<typeof createImageCropper>;

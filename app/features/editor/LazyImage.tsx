import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

/**
 * Defer decoding of an image until it approaches the viewport.
 *
 * CYOA documents embed images as base64 data URLs (often ~200-300 KB each), so
 * mounting many thumbnails at once makes the browser decode them all eagerly
 * and freezes the main thread. This component renders the `<img>` without a
 * `src` until the element is near the viewport (IntersectionObserver), then
 * sets it — images load progressively as the user scrolls instead of all at
 * once. Falls back to immediate loading when IntersectionObserver is missing.
 */
export function LazyImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  return <img ref={ref} src={inView ? src : undefined} {...props} />;
}

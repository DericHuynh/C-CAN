import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { getImagePreview } from "@shared/image-preview";
import type { ImageResource } from "@shared/types";

type Preview = NonNullable<ImageResource["preview"]>;
const Previews = createContext<ReadonlyMap<string, Preview>>(new Map());
const PreloadImages = createContext(false);

/** One lookup table per viewer, including URLs returned by runtime image variants. */
export function ImagePreviewProvider({
  images,
  children,
  preload = false,
}: {
  images: ImageResource[];
  children: ReactNode;
  preload?: boolean;
}) {
  const previews = useMemo(() => {
    const map = new Map<string, Preview>();
    for (const image of images) {
      const preview = getImagePreview(image);
      if (preview) map.set(preview.source, preview);
    }
    return map;
  }, [images]);
  return (
    <PreloadImages.Provider value={preload}>
      <Previews.Provider value={previews}>{children}</Previews.Provider>
    </PreloadImages.Provider>
  );
}

/** Keep the preview until the requested source is decoded; ignore obsolete requests. */
export function useLodSource(
  src: string | undefined,
  preview: Preview | undefined,
  active: boolean,
) {
  const [loaded, setLoaded] = useState<string>();
  useEffect(() => {
    if (!active || !src || !preview || loaded === src) return;
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        if (image.decode) await image.decode();
        if (!cancelled) setLoaded(src);
      } catch {
        // A decoding failure keeps the usable preview in place.
      }
    };
    image.src = src;
    return () => {
      cancelled = true;
      image.onload = null;
      image.removeAttribute("src");
    };
  }, [src, preview, active, loaded]);
  return preview && loaded !== src ? preview.data : src;
}

export function useViewerBackground(src: string | undefined, active = true) {
  const preview = useContext(Previews).get(src ?? "");
  return useLodSource(src, preview, active);
}

export function ViewerImage({ src, style, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const preview = useContext(Previews).get(src ?? "");
  const preload = useContext(PreloadImages);
  const ref = useRef<HTMLImageElement>(null);
  const [nearby, setNearby] = useState(false);
  useEffect(() => {
    if (nearby) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearby(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearby(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [nearby]);
  const displayed = useLodSource(src, preview, nearby || preload);
  return (
    <img
      {...props}
      ref={ref}
      src={displayed}
      loading={props.loading ?? (preview || preload ? "eager" : "lazy")}
      decoding="async"
      data-image-lod={preview && displayed === preview.data ? "preview" : "full"}
      data-image-source={src}
      style={{
        ...(preview ? { aspectRatio: `${preview.width} / ${preview.height}` } : {}),
        ...style,
      }}
    />
  );
}

import { CyoaViewer as Viewer } from "@/features/viewer/CyoaViewer";
import { useLivePreview } from "@/features/editor/LiveProjectFields";
import type { CyoaViewerProps } from "@/features/viewer/types";

/** Authoring-only adapter. Published viewers never read collaborative drafts. */
export function CyoaViewer(props: CyoaViewerProps) {
  const app = useLivePreview(props.app);
  return <Viewer {...props} app={app} />;
}

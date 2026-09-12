import type { LoaderFunctionArgs } from "react-router";

export { default, meta } from "@/features/projects/ProjectPage";

export function loader({ params }: LoaderFunctionArgs) {
  if (!["editor", "visual-editor", "viewer"].includes(params.mode ?? "")) {
    throw new Response("Not found", { status: 404 });
  }
  return null;
}

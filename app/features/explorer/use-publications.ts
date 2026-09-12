import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import type { ExplorerFilters } from "@shared/publications";
export const usePublications = (filters: ExplorerFilters) =>
  useActionQuery("list-publications", filters);
export const usePublication = (id: string, includeDocument = false) =>
  useActionQuery("get-publication", { id, includeDocument }, { enabled: Boolean(id) });
export const usePublicationStatus = (projectId: string) =>
  useActionQuery("get-publication-status", { projectId });
export const usePublishProject = () => useActionMutation("publish-project");
export const useUnpublishProject = () => useActionMutation("unpublish-project");
export const useRatePublication = () => useActionMutation("rate-publication");

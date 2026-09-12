import { createContext, useContext, type ReactNode } from "react";
import type { ProjectDetail } from "@shared/project-contracts";
import { DraftCollaborationProvider } from "./DraftCollaboration";
import { LiveProjectFields } from "./LiveProjectFields";
const Context = createContext<ProjectDetail | null>(null);
export function EditorProjectProvider({
  project,
  children,
}: {
  project: ProjectDetail;
  children: ReactNode;
}) {
  return (
    <Context.Provider value={project}>
      <LiveProjectFields project={project}>
        <DraftCollaborationProvider>{children}</DraftCollaborationProvider>
      </LiveProjectFields>
    </Context.Provider>
  );
}
export const useEditorProject = () => useContext(Context);

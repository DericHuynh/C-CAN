import { lazy } from "react";
import { TabsContent } from "@/components/ui/tabs";
import type { ProjectDetail } from "@shared/project-contracts";

const BackpackPanel = lazy(() =>
  import("@/features/editor/BackpackPanel").then((module) => ({ default: module.BackpackPanel })),
);
const CategoriesPanel = lazy(() =>
  import("@/features/editor/CategoriesPanel").then((module) => ({
    default: module.CategoriesPanel,
  })),
);
const CustomCssPanel = lazy(() =>
  import("@/features/editor/CustomCssPanel").then((module) => ({ default: module.CustomCssPanel })),
);
const DesignGroupsPanel = lazy(() =>
  import("@/features/editor/DesignGroupsPanel").then((module) => ({
    default: module.DesignGroupsPanel,
  })),
);
const DesignPanel = lazy(() =>
  import("@/features/editor/DesignPanel").then((module) => ({ default: module.DesignPanel })),
);
const GroupPanel = lazy(() =>
  import("@/features/editor/GroupPanel").then((module) => ({ default: module.GroupPanel })),
);
const IdListPanel = lazy(() =>
  import("@/features/editor/IdListPanel").then((module) => ({ default: module.IdListPanel })),
);
const ImagesPanel = lazy(() =>
  import("@/features/editor/ImagesPanel").then((module) => ({ default: module.ImagesPanel })),
);
const JsonPanel = lazy(() =>
  import("@/features/editor/JsonPanel").then((module) => ({ default: module.JsonPanel })),
);
const PointTypePanel = lazy(() =>
  import("@/features/editor/PointTypePanel").then((module) => ({ default: module.PointTypePanel })),
);
const ProjectStatsPanel = lazy(() =>
  import("@/features/editor/ProjectStatsPanel").then((module) => ({
    default: module.ProjectStatsPanel,
  })),
);
const RequirementPanel = lazy(() =>
  import("@/features/editor/RequirementPanel").then((module) => ({
    default: module.RequirementPanel,
  })),
);
const ProjectHistoryPanel = lazy(() =>
  import("@/features/editor/ProjectHistoryPanel").then((module) => ({
    default: module.ProjectHistoryPanel,
  })),
);
const ProjectReviewPanel = lazy(() =>
  import("@/features/editor/ProjectReviewPanel").then((module) => ({
    default: module.ProjectReviewPanel,
  })),
);
const RowsPanel = lazy(() =>
  import("@/features/editor/RowsPanel").then((module) => ({ default: module.RowsPanel })),
);
const SettingsPanel = lazy(() =>
  import("@/features/editor/SettingsPanel").then((module) => ({ default: module.SettingsPanel })),
);
const SoundEffectsPanel = lazy(() =>
  import("@/features/editor/SoundEffectsPanel").then((module) => ({
    default: module.SoundEffectsPanel,
  })),
);
const TemplatesPanel = lazy(() =>
  import("@/features/editor/TemplatesPanel").then((module) => ({ default: module.TemplatesPanel })),
);
const VariablesPanel = lazy(() =>
  import("@/features/editor/VariablesPanel").then((module) => ({ default: module.VariablesPanel })),
);
const ViewerConfigPanel = lazy(() =>
  import("@/features/editor/ViewerConfigPanel").then((module) => ({
    default: module.ViewerConfigPanel,
  })),
);
const WordsPanel = lazy(() =>
  import("@/features/editor/WordsPanel").then((module) => ({ default: module.WordsPanel })),
);

/** Tabs mount only their active panel; lazy imports keep other editors out of its initial bundle. */
export function EditorPanels({
  project,
  onRestored,
}: {
  project: ProjectDetail;
  onRestored: () => void;
}) {
  return (
    <>
      <TabsContent value="rows" className="mt-4">
        <RowsPanel project={project} />
      </TabsContent>
      <TabsContent value="points" className="mt-4">
        <PointTypePanel project={project} />
      </TabsContent>
      <TabsContent value="groups" className="mt-4">
        <GroupPanel project={project} />
      </TabsContent>
      <TabsContent value="images" className="mt-4">
        <ImagesPanel project={project} />
      </TabsContent>
      <TabsContent value="requirements" className="mt-4">
        <RequirementPanel project={project} />
      </TabsContent>
      <TabsContent value="variables" className="mt-4">
        <VariablesPanel project={project} />
      </TabsContent>
      <TabsContent value="words" className="mt-4">
        <WordsPanel project={project} />
      </TabsContent>
      <TabsContent value="design-groups" className="mt-4">
        <DesignGroupsPanel project={project} />
      </TabsContent>
      <TabsContent value="categories" className="mt-4">
        <CategoriesPanel project={project} />
      </TabsContent>
      <TabsContent value="backpack" className="mt-4">
        <BackpackPanel project={project} />
      </TabsContent>
      <TabsContent value="design" className="mt-4">
        <DesignPanel project={project} />
      </TabsContent>
      <TabsContent value="templates" className="mt-4">
        <TemplatesPanel project={project} />
      </TabsContent>
      <TabsContent value="sound-effects" className="mt-4">
        <SoundEffectsPanel project={project} />
      </TabsContent>
      <TabsContent value="viewer-config" className="mt-4">
        <ViewerConfigPanel project={project} />
      </TabsContent>
      <TabsContent value="custom-css" className="mt-4">
        <CustomCssPanel project={project} />
      </TabsContent>
      <TabsContent value="stats" className="mt-4">
        <ProjectStatsPanel project={project} />
      </TabsContent>
      <TabsContent value="history" className="mt-4">
        <ProjectHistoryPanel key={project.id} project={project} onRestored={onRestored} />
      </TabsContent>
      <TabsContent value="review" className="mt-4">
        <ProjectReviewPanel key={project.id} project={project} />
      </TabsContent>
      <TabsContent value="id-list" className="mt-4">
        <IdListPanel project={project} />
      </TabsContent>
      <TabsContent value="settings" className="mt-4">
        <SettingsPanel project={project} />
      </TabsContent>
      <TabsContent value="json" className="mt-4">
        <JsonPanel project={project} />
      </TabsContent>
    </>
  );
}

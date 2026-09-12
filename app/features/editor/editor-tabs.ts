/** Editor tabs grouped into a two-level navigation. */
export const TAB_GROUPS: { id: string; label: string; tabs: { value: string; label: string }[] }[] =
  [
    {
      id: "content",
      label: "Content",
      tabs: [
        { value: "rows", label: "Rows" },
        { value: "points", label: "Points" },
        { value: "groups", label: "Groups" },
        { value: "images", label: "Images" },
        { value: "requirements", label: "Requirements" },
        { value: "variables", label: "Variables" },
        { value: "words", label: "Words" },
      ],
    },
    {
      id: "design",
      label: "Design",
      tabs: [
        { value: "design-groups", label: "Design Groups" },
        { value: "categories", label: "Categories" },
        { value: "backpack", label: "Backpack" },
        { value: "design", label: "Design" },
        { value: "templates", label: "Templates" },
        { value: "sound-effects", label: "Sound Effects" },
      ],
    },
    {
      id: "viewer",
      label: "Viewer",
      tabs: [
        { value: "viewer-config", label: "Viewer Config" },
        { value: "custom-css", label: "Custom CSS" },
      ],
    },
    {
      id: "project",
      label: "Project",
      tabs: [
        { value: "stats", label: "Stats" },
        { value: "history", label: "History" },
        { value: "review", label: "Review" },
        { value: "id-list", label: "ID List" },
        { value: "settings", label: "Settings" },
        { value: "json", label: "JSON" },
      ],
    },
  ];

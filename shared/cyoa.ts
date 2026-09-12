/**
 * ICCPlus CYOA domain helpers.
 *
 * Ported from the Svelte ICCPlus store (`ICCPlus/src/lib/store/store.svelte.ts`)
 * so that the agent-native app produces and reads the exact same CYOA JSON
 * documents as the original creator.
 */
import type {
  Addon,
  App,
  Choice,
  GlobalRequirement,
  Group,
  ImageResource,
  ObjectDesignGroup,
  PointType,
  Requireds,
  Row,
  RowDesignGroup,
  Score,
  Styling,
  Variable,
  Word,
  Category,
  SoundEffect,
  ViewerConfig,
} from "./types";

export const appVersion = "2.9.29";

export function cloneDeep<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Port of the ICCPlus `generateId` helper. Produces ids like
 * `row-a1b2`, `choice-x9k2`, `s-12345`, `addon-9f3q`, `group-...`.
 *
 * The original retried on collisions with already-initialized entities via
 * `checkInitId` (with a `return id` base case). This port drops the collision
 * guard (a retry that just re-rolls the same charset is good enough for
 * authoring ids) and returns the generated id directly.
 */
export function generateId(
  repeated: number,
  strLength: number,
  type: string,
  addPrefix: boolean,
): string {
  const str = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = addPrefix ? `${type}-` : "";
  for (let o = 0; o < strLength; o++) {
    id += str.charAt(Math.floor(Math.random() * str.length));
  }
  return id;
}

export function newRowId(app: Pick<App, "rowIdLength" | "addPrefix">): string {
  return generateId(0, app.rowIdLength ?? 4, "row", app.addPrefix ?? true);
}

export function newChoiceId(app: Pick<App, "objectIdLength" | "addPrefix">): string {
  return generateId(0, app.objectIdLength ?? 4, "choice", app.addPrefix ?? true);
}

export function newAddonId(app: Pick<App, "objectIdLength" | "addPrefix">): string {
  return generateId(0, app.objectIdLength ?? 4, "addon", app.addPrefix ?? true);
}

export function newScoreId(): string {
  return generateId(0, 5, "s", true);
}

/** Generic prefixed id matching the original `generateId(0, 4, '<type>')` calls. */
export function newGenericId(prefix: string): string {
  return generateId(0, 4, prefix, true);
}

/* ------------------------------------------------------------------ */
/* Default styling objects (ported verbatim from the ICCPlus store)    */
/* ------------------------------------------------------------------ */

export const filterStyling = {
  selFilterBlurIsOn: false,
  selFilterBlur: 0,
  selFilterBrightIsOn: false,
  selFilterBright: 100,
  selFilterContIsOn: false,
  selFilterCont: 100,
  selFilterGrayIsOn: false,
  selFilterGray: 0,
  selFilterHueIsOn: false,
  selFilterHue: 0,
  selFilterInvertIsOn: false,
  selFilterInvert: 0,
  selFilterOpacIsOn: false,
  selFilterOpac: 100,
  selFilterSaturIsOn: false,
  selFilterSatur: 1,
  selFilterSepiaIsOn: false,
  selFilterSepia: 0,
  selBgColorIsOn: true,
  selOverlayOnImage: false,
  selFilterBgColor: "#70FF7EFF",
  selBorderColorIsOn: false,
  selFilterBorderColor: "#000000FF",
  selImgBorderColorIsOn: false,
  selFilterImgBorderColor: "#000000FF",
  selCTitleColorIsOn: false,
  selFilterCTitleColor: "#000000FF",
  selCTextColorIsOn: false,
  selFilterCTextColor: "#000000FF",
  selATitleColorIsOn: false,
  selFilterATitleColor: "#000000FF",
  selATextColorIsOn: false,
  selFilterATextColor: "#000000FF",
  selScoreTextColorIsOn: false,
  selFilterSTextColor: "#000000FF",
  selFilterVisibleIsOn: false,
  reqFilterBlurIsOn: false,
  reqFilterBlur: 0,
  reqFilterBrightIsOn: false,
  reqFilterBright: 100,
  reqFilterContIsOn: false,
  reqFilterCont: 100,
  reqFilterGrayIsOn: false,
  reqFilterGray: 0,
  reqFilterHueIsOn: false,
  reqFilterHue: 0,
  reqFilterInvertIsOn: false,
  reqFilterInvert: 0,
  reqFilterOpacIsOn: true,
  reqFilterOpac: 50,
  reqFilterSaturIsOn: false,
  reqFilterSatur: 1,
  reqFilterSepiaIsOn: false,
  reqFilterSepia: 0,
  reqBgColorIsOn: false,
  reqOverlayOnImage: false,
  reqFilterBgColor: "#FFFFFFFF",
  reqBorderColorIsOn: false,
  reqFilterBorderColor: "#000000FF",
  reqImgBorderColorIsOn: false,
  reqImgFilterBorderColor: "#000000FF",
  reqCTitleColorIsOn: false,
  reqFilterCTitleColor: "#000000FF",
  reqCTextColorIsOn: false,
  reqFilterCTextColor: "#000000FF",
  reqATitleColorIsOn: false,
  reqFilterATitleColor: "#000000FF",
  reqATextColorIsOn: false,
  reqFilterATextColor: "#000000FF",
  reqScoreTextColorIsOn: false,
  reqFilterSTextColor: "#000000FF",
  reqFilterVisibleIsOn: false,
  unselFilterBlurIsOn: false,
  unselFilterBlur: 0,
  unselFilterBrightIsOn: false,
  unselFilterBright: 100,
  unselFilterContIsOn: false,
  unselFilterCont: 100,
  unselFilterGrayIsOn: false,
  unselFilterGray: 0,
  unselFilterHueIsOn: false,
  unselFilterHue: 0,
  unselFilterInvertIsOn: false,
  unselFilterInvert: 0,
  unselFilterOpacIsOn: false,
  unselFilterOpac: 100,
  unselFilterSaturIsOn: false,
  unselFilterSatur: 1,
  unselFilterSepiaIsOn: false,
  unselFilterSepia: 0,
  unselFilterVisibleIsOn: false,
};

export const textStyling = {
  customRowTitle: false,
  rowTitle: "Times New Roman",
  customRowText: false,
  rowText: "Times New Roman",
  customObjectTitle: false,
  objectTitle: "Times New Roman",
  customObjectText: false,
  objectText: "Times New Roman",
  customAddonTitle: false,
  addonTitle: "Times New Roman",
  customAddonText: false,
  addonText: "Times New Roman",
  customScoreText: false,
  scoreText: "Times New Roman",
  rowTitleTextSize: 200,
  rowTextTextSize: 100,
  objectTitleTextSize: 200,
  objectTextTextSize: 100,
  addonTitleTextSize: 200,
  addonTextTextSize: 100,
  scoreTextSize: 75,
  rowTitleColor: "#000000",
  rowTextColor: "#000000",
  objectTitleColor: "#000000",
  objectTextColor: "#000000",
  addonTitleColor: "#000000",
  addonTextColor: "#000000",
  scoreTextColor: "#000000",
  rowTitleAlign: "center",
  rowTextAlign: "center",
  objectTitleAlign: "center",
  objectTextAlign: "center",
  addonTitleAlign: "center",
  addonTextAlign: "center",
  scoreTextAlign: "center",
};

export const objectImageStyling = {
  objectImgBorderStyle: "solid",
  objectImgBorderWidth: 2,
  objectImageWidth: 100,
  objectImageMarginTop: 0,
  objectImageMarginBottom: 0,
  objectImgBorderRadiusTopLeft: 0,
  objectImgBorderRadiusTopRight: 0,
  objectImgBorderRadiusBottomRight: 0,
  objectImgBorderRadiusBottomLeft: 0,
  objectImgBorderRadiusIsPixels: true,
  objectImgBorderIsOn: false,
  objectImgOverflowIsOn: false,
  objectImgBorderColor: "red",
  objectImgObjectFillStyle: "",
  objectImgObjectFillIsOn: false,
  objectImgObjectFillHeight: 0,
  objectImageBoxWidth: 50,
};

export const rowImageStyling = {
  rowImgBorderStyle: "solid",
  rowImgBorderWidth: 2,
  rowImageWidth: 100,
  rowImageMarginTop: 0,
  rowImageMarginBottom: 0,
  rowImgBorderRadiusTopLeft: 0,
  rowImgBorderRadiusTopRight: 0,
  rowImgBorderRadiusBottomRight: 0,
  rowImgBorderRadiusBottomLeft: 0,
  rowImgBorderRadiusIsPixels: true,
  rowImgBorderIsOn: false,
  rowImgOverflowIsOn: false,
  rowImgBorderColor: "red",
  rowImageBoxWidth: 50,
  rowImgObjectFillStyle: "",
  rowImgObjectFillIsOn: false,
  rowImgObjectFillHeight: 0,
};

export const addonImageStyling = {
  useAddonImage: false,
  addonImgBorderStyle: "solid",
  addonImgBorderWidth: 2,
  addonImageWidth: 100,
  addonImageMarginTop: 0,
  addonImageMarginBottom: 0,
  addonImgBorderRadiusTopLeft: 0,
  addonImgBorderRadiusTopRight: 0,
  addonImgBorderRadiusBottomRight: 0,
  addonImgBorderRadiusBottomLeft: 0,
  addonImgBorderRadiusIsPixels: true,
  addonImgBorderIsOn: false,
  addonImgOverflowIsOn: false,
  addonImgBorderColor: "red",
  addonImgObjectFillStyle: "",
  addonImgObjectFillIsOn: false,
  addonImgObjectFillHeight: 0,
  addonImageBoxWidth: 50,
};

export const backgroundStyling = {
  bgColorIsOn: false,
  backgroundColor: "#FFFFFFFF",
  rowBgColorIsOn: false,
  rowBgColor: "#FFFFFFFF",
  objectBgColorIsOn: false,
  objectBgColor: "#FFFFFFFF",
  isBackgroundRepeat: false,
  isBackgroundFitIn: false,
  isBackgroundOverlay: false,
  backgroundImage: "",
  isRowBackgroundRepeat: false,
  isRowBackgroundFitIn: false,
  isRowBackgroundOverlay: false,
  rowBackgroundImage: "",
  isObjectBackgroundRepeat: false,
  isObjectBackgroundFitIn: false,
  isObjectBackgroundOverlay: false,
  objectBackgroundImage: "",
};

export const objectStyling = {
  objectHeight: true,
  objectDesignIsAdvanced: false,
  objectMargin: 10,
  objectTextPadding: 10,
  objectBorderStyle: "solid",
  objectBorderWidth: 2,
  objectBorderIsOn: false,
  objectDropShadowH: 0,
  objectDropShadowV: 0,
  objectDropShadowBlur: 0,
  objectDropShadowSpread: 0,
  objectDropShadowIsOn: false,
  objectUseBoxShadowIsOn: false,
  objectBorderRadiusTopLeft: 0,
  objectBorderRadiusTopRight: 0,
  objectBorderRadiusBottomRight: 0,
  objectBorderRadiusBottomLeft: 0,
  objectBorderRadiusIsPixels: true,
  objectOverflowIsOn: true,
  objectDropShadowColor: "grey",
  objectGradientIsOn: false,
  objectGradient: "",
  objectGradientOnSelect: "",
  objectGradientOnReq: "",
  objectBorderColor: "red",
  objectBorderImage: "",
  objectBorderImageRepeat: "stretch",
  objectBorderImageWidth: 5,
  objectBorderImageSliceTop: 5,
  objectBorderImageSliceBottom: 5,
  objectBorderImageSliceLeft: 5,
  objectBorderImageSliceRight: 5,
  removeSpaceAddonIsOn: false,
  titlePaddingIsOn: false,
};

export const rowStyling = {
  rowDesignIsAdvanced: false,
  rowMargin: 10,
  rowBodyMarginSides: 1,
  rowBodyMarginTop: 25,
  rowBodyMarginBottom: 25,
  rowHeaderMarginBottom: 0,
  rowTextPaddingY: 5,
  rowTextPaddingX: 10,
  rowOverflowIsOn: true,
  rowDropShadowH: 0,
  rowDropShadowV: 0,
  rowDropShadowBlur: 0,
  rowDropShadowSpread: 0,
  rowDropShadowColor: "grey",
  rowButtonXPadding: 0,
  rowButtonYPadding: 0,
  rowDropShadowIsOn: false,
  rowUseBoxShadowIsOn: false,
  rowBorderRadiusTopLeft: 0,
  rowBorderRadiusTopRight: 0,
  rowBorderRadiusBottomRight: 0,
  rowBorderRadiusBottomLeft: 0,
  rowBorderRadiusIsPixels: true,
  rowBorderStyle: "solid",
  rowBorderWidth: 2,
  rowBorderIsOn: false,
  rowBorderColor: "red",
  rowGradientIsOn: false,
  rowGradient: "",
  rowBorderImage: "",
  rowBorderImageRepeat: "stretch",
  rowBorderImageWidth: 5,
  rowBorderImageSliceTop: 5,
  rowBorderImageSliceBottom: 5,
  rowBorderImageSliceLeft: 5,
  rowBorderImageSliceRight: 5,
};

export const addonStyling = {
  useAddonDesign: false,
  addonDesignIsAdvanced: false,
  addonMargin: 10,
  addonTextPadding: 10,
  addonBorderStyle: "solid",
  addonBorderWidth: 2,
  addonBorderIsOn: false,
  addonDropShadowH: 0,
  addonDropShadowV: 0,
  addonDropShadowBlur: 0,
  addonDropShadowSpread: 0,
  addonDropShadowIsOn: false,
  addonUseBoxShadowIsOn: false,
  addonBorderRadiusTopLeft: 0,
  addonBorderRadiusTopRight: 0,
  addonBorderRadiusBottomRight: 0,
  addonBorderRadiusBottomLeft: 0,
  addonBorderRadiusIsPixels: true,
  addonOverflowIsOn: true,
  addonDropShadowColor: "grey",
  addonGradientIsOn: false,
  addonGradient: "",
  addonGradientOnSelect: "",
  addonGradientOnReq: "",
  addonBorderColor: "red",
  addonBorderImage: "",
  addonBorderImageRepeat: "stretch",
  addonBorderImageWidth: 5,
  addonBorderImageSliceTop: 5,
  addonBorderImageSliceBottom: 5,
  addonBorderImageSliceLeft: 5,
  addonBorderImageSliceRight: 5,
  useAddonBackgroundImage: false,
  addonBackgroundImage: "",
  isAddonBackgroundFitIn: false,
  isAddonBackgroundRepeat: false,
  isAddonBackgroundOverlay: false,
  addonBgColorIsOn: false,
  addonBgColor: "#FFFFFFFF",
  addonTitlePaddingIsOn: false,
};

export const multiChoiceStyling = {
  customMultiTextFont: false,
  multiChoiceCounterPosition: 0,
  multiChoiceCounterSize: 170,
  multiChoiceTextFont: "Times New Roman",
  multiChoiceTextSize: 100,
};

export const pointBarStyling = {
  barTextPadding: 17,
  barTextMargin: 0,
  customBarTextFont: false,
  barTextFont: "Times New Roman",
  barPadding: 0,
  barMargin: 0,
  barTextSize: 15,
  barTextColor: "#000000",
  barPointPos: "#FF0000FF",
  barPointNeg: "#FF0000FF",
  barIconColor: "#0000008A",
  barBackgroundColor: "#FFFFFFFF",
};

export const backpackStyling = {
  useBackpackDesign: false,
  backpackBgColor: "#FFFFFF",
  isBackpackBgRepeat: false,
  isBackpackBgFitIn: false,
  backpackBgImage: "",
  backPackWidth: 1400,
};

export const defaultStyling: Styling = {
  ...filterStyling,
  ...textStyling,
  ...objectImageStyling,
  ...rowImageStyling,
  ...addonImageStyling,
  ...backgroundStyling,
  ...objectStyling,
  ...rowStyling,
  ...addonStyling,
  ...multiChoiceStyling,
  ...pointBarStyling,
  ...backpackStyling,
};

/* ------------------------------------------------------------------ */
/* Entity factories                                                    */
/* ------------------------------------------------------------------ */

export function createDefaultRequireds(): Requireds {
  return {
    required: false,
    requireds: [],
    orRequired: [],
    id: newGenericId("req"),
    type: "point",
    reqId: "",
    reqId1: "",
    reqId2: "",
    reqId3: "",
    reqPoints: 0,
    showRequired: true,
    afterText: "",
    beforeText: "",
    more: [],
  };
}

export function createDefaultScore(typeId: string, value = 1): Score {
  return {
    idx: newScoreId(),
    id: typeId,
    value,
    type: "point",
    beforeText: "",
    afterText: "",
    requireds: [],
    showScore: true,
  };
}

export function createDefaultAddon(
  app: Pick<
    App,
    | "defaultAddonTitle"
    | "defaultAddonText"
    | "defaultAddonJustify"
    | "defaultAddonTemplate"
    | "defaultAddonWidth"
    | "objectIdLength"
    | "addPrefix"
  >,
): Addon {
  return {
    id: newAddonId(app),
    title: app.defaultAddonTitle ?? "Addon",
    text: app.defaultAddonText ?? "",
    template: app.defaultAddonTemplate ?? 1,
    image: "",
    requireds: [],
    addonWidth: app.defaultAddonWidth ?? "col-12",
    isSelectable: false,
  } as unknown as Addon;
}

export function createDefaultChoice(app: App, index: number): Choice {
  return {
    id: newChoiceId(app),
    index,
    title: app.defaultChoiceTitle ?? "Choice",
    text: app.defaultChoiceText ?? "",
    debugTitle: "",
    image: "",
    template: app.defaultChoiceTemplate ?? 1,
    objectWidth: app.defaultChoiceWidth ?? "",
    isActive: false,
    multipleUseVariable: app.defaultChoiceMaxNum ?? 99,
    selectedThisManyTimesProp: 0,
    requireds: [],
    addons: [],
    scores: [],
    groups: [],
  };
}

export function createDefaultRow(app: App, index: number): Row {
  return {
    id: newRowId(app),
    index,
    title: app.defaultRowTitle ?? "Row",
    titleText: app.defaultRowText ?? "",
    debugTitle: "",
    objectWidth: app.defaultRowWidth ?? "col-md-3",
    image: "",
    template: app.defaultRowTemplate ?? 1,
    isButtonRow: false,
    buttonType: true,
    buttonId: "",
    buttonText: "Click",
    buttonRandom: false,
    buttonRandomNumber: 1,
    defaultAspectWidth: 1,
    defaultAspectHeight: 1,
    allowedChoices: app.defaultRowAllowedChoices ?? 0,
    currentChoices: 0,
    requireds: [],
    objects: [],
    rowJustify: app.defaultRowJustify ?? "start",
    groups: [],
  };
}

export function createDefaultPointType(app: App, name = "Points"): PointType {
  return {
    id: generateId(0, 4, "point", app.addPrefix ?? true),
    name,
    startingSum: 0,
    initValue: 0,
    activatedId: "",
    beforeText: app.defaultBeforePoint ?? "Cost:",
    afterText: app.defaultAfterPoint ?? "points",
    belowZeroNotAllowed: false,
    isNotShownPointBar: false,
    isNotShownObjects: false,
    allowFloat: false,
    decimalPlaces: 0,
  };
}

export function createDefaultGroup(name = "Group"): Group {
  return {
    id: newGenericId("group"),
    name,
    elements: [],
    rowElements: [],
  };
}

export function createDefaultGlobalRequirement(name = "Requirement"): GlobalRequirement {
  return {
    id: newGenericId("greq"),
    name,
    requireds: [],
  };
}

export function createDefaultVariable(): Variable {
  return {
    id: newGenericId("variable"),
    isTrue: false,
  };
}

export function createDefaultWord(): Word {
  return {
    id: newGenericId("word"),
    replaceText: "",
  };
}

export function createDefaultImageResource(name = ""): ImageResource {
  return {
    id: newGenericId("image"),
    name,
    image: "",
    imageIsURL: true,
  };
}

export function createDefaultCategory(name = "Category"): Category {
  return {
    idx: 0,
    name,
    type: "point",
  };
}

export function createDefaultSoundEffect(name = "Sound"): SoundEffect {
  return {
    id: newGenericId("sfx"),
    name,
    audio: "",
    volume: 100,
    pitch: 1,
    isDefault: false,
    onSelected: false,
    onDeselected: false,
    requireds: [],
    groups: [],
  };
}

export const defaultViewerConfig: ViewerConfig = {
  title: "CYOA Plus 2",
  favicon: "",
  loadingType: "ind1",
  loadingBgColor: "#232428",
  loadingBgImage: "",
  loadingCircleColor: "#d5c999",
  loadingTrackColor: "#3c3c3c",
  loadingText: "Loading",
  loadingTextColor: "#d5c999",
  loadingTextFont: "Arial",
  loadingTextShadow: "#fff000",
  useSeparateImages: false,
  useLocalViewer: false,
};

/* ------------------------------------------------------------------ */
/* Default app document                                                */
/* ------------------------------------------------------------------ */

export function createDefaultApp(): App {
  return {
    version: appVersion,
    isEditModeOnAll: true,
    isPointerCursor: false,
    importedChoicesIsOpen: true,
    curVolume: 100,
    isMute: false,
    showMusicPlayer: false,
    fadeTransitionColor: "#000000FF",
    fadeTransitionTime: 0.25,
    fadeTransitionIsOn: false,
    hideBackpackBtn: 0,
    btnBackpackIsOn: 0,
    showAllAddons: 0,
    tmpRow: [],
    tmpChoice: [],
    tmpRequired: [],
    tmpScore: [],
    tmpAddon: [],
    tmpGroup: [],
    tmpDesignGroup: [],
    rowIdLength: 4,
    objectIdLength: 4,
    words: [],
    groups: [],
    rowDesignGroups: [],
    objectDesignGroups: [],
    objectsPerRow: "default",
    globalRequirements: [],
    soundEffects: [],
    googleFonts: [],
    customFonts: [],
    customCSS: "",
    compressImageAuto: false,
    useTextEditor: true,
    useToolbarBtn: false,
    useChoiceEditBtn: true,
    hideScoresUpdated: false,
    hideChoiceDT: false,
    hideImages: false,
    preloadImages: false,
    preloadExternalImages: false,
    useVW: false,
    addPrefix: true,
    activated: [],
    rows: [],
    pointTypes: [],
    variables: [],
    mdObjects: [],
    categories: [],
    images: [],
    printThis: false,
    autoSaveIsOn: false,
    autoSaveInterval: 10,
    buildAutoSaveIsOn: false,
    buildAutoSaveInterval: 10,
    tooltipDelay: 1000,
    checkDeleteRow: true,
    checkDeleteObject: false,
    checkSelectAll: false,
    defaultRowTitle: "Row",
    defaultRowText:
      "This is a row, and inside of it, you can place choices. On both rows and choices Requirements can be placed, which will block a row from being viewed, or make the player unable to select a choice, depending on either Point-types or the Ids of other choices. Point-types can be made in Features then Manage Points. Hovering over buttons will explain what they do. The Design of the project can be changed in 'Modify Design' at the side navigation bar, and private styling for each row can be turned on in the rows Settings. Default text like this can be turned off in Features -> Manage Defaults.",
    defaultChoiceTitle: "Choice",
    defaultChoiceText:
      "This is a Choice, and inside of it, you can place images and text. Scores can be added to it, and have Point-types attached. Addons can be added underneath the image and text. In the Functions at the bottom of the choice, there is an array of different things that can be done. Default text like this can be turned off in Features then Manage Defaults.",
    defaultBeforePoint: "Cost:",
    defaultAfterPoint: "points",
    defaultBeforeReq: "Required:",
    defaultAfterReq: "",
    defaultAddonTitle: "Addon",
    defaultAddonText: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    enableShortcut: true,
    orderOrReqText: "0",
    defaultOrReq: "of",
    orderSelReqText: "0",
    defaultSelReq: "choice from",
    defaultRowTemplate: 1,
    defaultRowWidth: "col-md-3",
    defaultRowJustify: "start",
    defaultRowAllowedChoices: 0,
    defaultChoiceTemplate: 1,
    defaultChoiceWidth: "",
    defaultChoiceMaxNum: 99,
    defaultAddonJustify: "start",
    defaultAddonTemplate: 1,
    defaultAddonWidth: "col-12",
    defaultUseSeperateAddon: false,
    defaultUseShowAddon: false,
    defaultUseHideAddon: false,
    defaultUseShowScore: true,
    defaultUseHideValue: false,
    defaultUseShowReq: false,
    cropperPosition: 4,
    enableSearch: true,
    useDesignGroupBtn: false,
    smallerScreenPx: 720,
    enableHalfRow: false,
    minimizeTemplate: true,
    viewerConfig: { ...defaultViewerConfig },
    backpack: [
      {
        index: 0,
        id: "default_backpack_row",
        isBackpack: true,
        title: "Result",
        debugTitle: "",
        titleText: "",
        objectWidth: "col-md-3",
        image: "",
        template: 1,
        rowJustify: "start",
        isButtonRow: false,
        buttonType: true,
        buttonId: "",
        buttonText: "Click",
        buttonRandom: false,
        buttonRandomNumber: 1,
        isResultRow: true,
        resultGroupId: "",
        isInfoRow: true,
        defaultAspectWidth: 1,
        defaultAspectHeight: 1,
        allowedChoices: 0,
        currentChoices: 0,
        requireds: [],
        isEditModeOn: false,
        isRequirementOpen: false,
        objects: [],
        rowDesignGroups: [],
      },
    ],
    styling: { ...defaultStyling },
  };
}

/**
 * Deep-merge an arbitrary parsed JSON document with the default app so that
 * older or partial ICCPlus documents always have every key the editor needs.
 * The document keeps any extra keys it carries (the format is intentionally
 * forward-compatible).
 */
export function parseProjectDocument(raw: unknown): Record<string, unknown> {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error("Invalid JSON provided for import: could not parse the supplied string.");
    }
  }
  if (!isPlainObject(parsed)) throw new Error("The imported JSON must be a CYOA document object.");
  for (const key of ["rows", "backpack", "pointTypes"]) {
    if (parsed[key] != null && !Array.isArray(parsed[key])) {
      throw new Error(`The CYOA document's ${key} field must be an array.`);
    }
  }
  return parsed;
}

export function normalizeApp(raw: unknown): App {
  const defaults = createDefaultApp();
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }
  // Migrations must never modify the caller's document (including cached
  // project data). In particular, repeated loads must not rescale old radii.
  const source = cloneDeep(raw) as Record<string, unknown>;
  const oldVersion = source.version == null || source.version === "2.0.0-beta";
  for (const key of Object.keys(defaults)) {
    if (source[key] === null) delete source[key];
  }

  const merged: Record<string, unknown> = { ...defaults, ...source };

  // Deep-merge nested objects whose shapes come from defaults.
  if (isPlainObject(source.styling)) {
    merged.styling = { ...defaults.styling, ...(source.styling as Record<string, unknown>) };
  }
  if (isPlainObject(source.viewerConfig)) {
    merged.viewerConfig = {
      ...defaults.viewerConfig,
      ...(source.viewerConfig as Record<string, unknown>),
    };
  }
  if (Array.isArray(source.backpack)) {
    merged.backpack = source.backpack.map((row, i) => ({
      ...(typeof row === "object" && row !== null ? row : {}),
      index: i,
    }));
  }
  if (!Array.isArray(merged.rows)) merged.rows = [];
  if (!Array.isArray(merged.pointTypes)) merged.pointTypes = [];
  if (!Array.isArray(merged.groups)) merged.groups = [];
  if (!Array.isArray(merged.globalRequirements)) merged.globalRequirements = [];
  if (!Array.isArray(merged.activated)) merged.activated = [];
  if (!Array.isArray(merged.variables)) merged.variables = [];
  if (!Array.isArray(merged.words)) merged.words = [];
  if (!Array.isArray(merged.categories)) merged.categories = [];
  if (!Array.isArray(merged.soundEffects)) merged.soundEffects = [];
  if (!Array.isArray(merged.rowDesignGroups)) merged.rowDesignGroups = [];
  if (!Array.isArray(merged.objectDesignGroups)) merged.objectDesignGroups = [];
  if (!Array.isArray(merged.images)) merged.images = [];

  for (const key of [
    "rows",
    "backpack",
    "pointTypes",
    "groups",
    "globalRequirements",
    "variables",
    "words",
    "categories",
    "soundEffects",
    "rowDesignGroups",
    "objectDesignGroups",
    "images",
  ]) {
    merged[key] = (Array.isArray(merged[key]) ? merged[key] : []).filter(isPlainObject);
  }
  // Clean known nested collections before migration; ICCPlus exports may
  // omit optional fields or contain nulls from earlier editor versions.
  const cleanList = (record: Record<string, unknown>, key: string) => {
    const items = (Array.isArray(record[key]) ? record[key] : []).filter(isPlainObject);
    record[key] = items;
    return items;
  };
  const cleanRequirements = (record: Record<string, unknown>) => {
    for (const key of ["requireds", "orRequireds"]) {
      if (key === "orRequireds" && record[key] == null) {
        delete record[key]; // preserve the legacy migration trigger
        continue;
      }
      for (const req of cleanList(record, key)) cleanRequirements(req);
    }
  };
  for (const row of [
    ...(merged.rows as Record<string, unknown>[]),
    ...(merged.backpack as Record<string, unknown>[]),
  ]) {
    cleanRequirements(row);
    for (const choice of cleanList(row, "objects")) {
      cleanRequirements(choice);
      for (const score of cleanList(choice, "scores")) cleanRequirements(score);
      for (const variant of cleanList(choice, "imageVariants")) cleanRequirements(variant);
      for (const addon of cleanList(choice, "addons")) {
        cleanRequirements(addon);
        if (addon.isSelectable) {
          for (const score of cleanList(addon, "scores")) cleanRequirements(score);
        }
      }
    }
  }
  for (const req of merged.globalRequirements as Record<string, unknown>[]) cleanRequirements(req);

  // Apply the same legacy-document migrations the original ICCPlus editor
  // runs in `initializeApp()`, so imported documents behave identically.
  if (oldVersion) merged.version = "2.0.0-beta";
  migrateApp(merged as App);
  if (oldVersion) merged.version = appVersion;

  const withDefaults = <T extends object>(value: T, fallback: T): T => {
    const present = Object.fromEntries(Object.entries(value).filter(([, v]) => v != null));
    return { ...fallback, ...present };
  };
  const app = merged as App;
  const normalizeRow = (row: Row, i: number): Row => {
    const {
      id,
      index,
      title,
      titleText,
      objectWidth,
      image,
      template,
      allowedChoices,
      currentChoices,
      requireds,
      objects,
      defaultAspectWidth,
      defaultAspectHeight,
    } = createDefaultRow(app, i);
    const normalized = withDefaults(row, {
      id,
      index,
      title,
      titleText,
      objectWidth,
      image,
      template,
      allowedChoices,
      currentChoices,
      requireds,
      objects,
      defaultAspectWidth,
      defaultAspectHeight,
    });
    normalized.objects = row.objects.map((choice, j) => {
      const result = withDefaults(choice, createDefaultChoice(app, j));
      result.index = j;
      result.addons = choice.addons.map((addon) => withDefaults(addon, createDefaultAddon(app)));
      return result;
    });
    return normalized;
  };
  app.rows = app.rows.map(normalizeRow);
  app.backpack = app.backpack.map(normalizeRow);

  return merged as App;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/* ------------------------------------------------------------------ */
/* Legacy document migration                                           */
/* ------------------------------------------------------------------ */

/** Border-radius keys that were stored 10x too large before v2.x. */
const RADIUS_KEYS = [
  "addonBorderRadiusTopLeft",
  "addonBorderRadiusTopRight",
  "addonBorderRadiusBottomLeft",
  "addonBorderRadiusBottomRight",
  "addonImgBorderRadiusTopLeft",
  "addonImgBorderRadiusTopRight",
  "addonImgBorderRadiusBottomLeft",
  "addonImgBorderRadiusBottomRight",
  "objectBorderRadiusTopLeft",
  "objectBorderRadiusTopRight",
  "objectBorderRadiusBottomLeft",
  "objectBorderRadiusBottomRight",
  "objectImgBorderRadiusTopLeft",
  "objectImgBorderRadiusTopRight",
  "objectImgBorderRadiusBottomLeft",
  "objectImgBorderRadiusBottomRight",
  "rowBorderRadiusTopLeft",
  "rowBorderRadiusTopRight",
  "rowBorderRadiusBottomLeft",
  "rowBorderRadiusBottomRight",
  "rowImgBorderRadiusTopLeft",
  "rowImgBorderRadiusTopRight",
  "rowImgBorderRadiusBottomLeft",
  "rowImgBorderRadiusBottomRight",
];

/** Styling keys that older versions stored as color-picker objects. */
const STYLING_COLOR_KEYS = [
  "selFilterBgColor",
  "selFilterBorderColor",
  "selFilterCTitleColor",
  "selFilterCTextColor",
  "selFilterATitleColor",
  "selFilterATextColor",
  "selFilterSTextColor",
  "reqFilterBgColor",
  "reqFilterBorderColor",
  "reqFilterCTitleColor",
  "reqFilterCTextColor",
  "reqFilterATitleColor",
  "reqFilterATextColor",
  "reqFilterSTextColor",
  "rowTitleColor",
  "rowTextColor",
  "objectTitleColor",
  "objectTextColor",
  "addonTitleColor",
  "addonTextColor",
  "scoreTextColor",
  "objectImgBorderColor",
  "rowImgBorderColor",
  "addonImgBorderColor",
  "backgroundColor",
  "rowBgColor",
  "objectBgColor",
  "objectDropShadowColor",
  "objectBorderColor",
  "rowDropShadowColor",
  "rowBorderColor",
  "addonDropShadowColor",
  "addonBorderColor",
  "addonBgColor",
  "barTextColor",
  "barIconColor",
  "barBackgroundColor",
  "backpackBgColor",
  "barPointNeg",
  "barPointPos",
];

/**
 * Port of the ICCPlus `initStyling` migration: fixes the old 10x border-radius
 * values, flattens color-picker objects into hex strings, and fills the
 * multi-choice styling defaults on the main styling object.
 */
function initStylingMigration(styling: Styling, oldVersion: boolean, isMain = false): void {
  const record = styling as unknown as Record<string, unknown>;
  if (oldVersion) {
    for (const key of RADIUS_KEYS) {
      if (typeof record[key] === "number") {
        record[key] = (record[key] as number) * 10;
      }
    }
  }
  for (const key of STYLING_COLOR_KEYS) {
    const value = record[key];
    if (isPlainObject(value) && typeof value.hexa !== "undefined") {
      record[key] = value.hexa;
    }
  }
  if (isMain) {
    if (typeof record.customMultiTextFont === "undefined") record.customMultiTextFont = false;
    if (typeof record.multiChoiceCounterPosition === "undefined")
      record.multiChoiceCounterPosition = 0;
    if (typeof record.multiChoiceCounterSize === "undefined") record.multiChoiceCounterSize = 170;
    if (typeof record.multiChoiceTextFont === "undefined")
      record.multiChoiceTextFont = "Times New Roman";
    if (typeof record.multiChoiceTextSize === "undefined") record.multiChoiceTextSize = 100;
  }
}

/** Legacy `orRequired` (array of `{ req }`) -> modern `orRequireds` (Requireds[]). */
function migrateOrRequireds(req: Requireds): void {
  if (req.type === "or" && req.orRequired && typeof req.orRequireds === "undefined") {
    req.orRequireds = [];
    for (const or of req.orRequired) {
      if (typeof or === "object" && or !== null) {
        req.orRequireds.push({
          required: true,
          requireds: [],
          orRequired: [],
          orRequireds: [],
          id: "",
          type: "id",
          reqId: (or as { req?: string }).req || "",
          reqId1: "",
          reqId2: "",
          reqId3: "",
          reqPoints: 0,
          showRequired: req.showRequired,
          operator: req.operator,
          afterText: req.afterText,
          beforeText: req.beforeText,
          orNum: req.orNum,
          selNum: req.selNum,
          selFromOperators: "1",
          more: [],
        });
      }
    }
  }
}

/** Recursively migrate a requirement list (matches `initializeApp`'s nested pass). */
function migrateRequireds(requireds: Requireds[] | undefined): void {
  if (!requireds) return;
  for (const req of requireds) {
    migrateOrRequireds(req);
    migrateRequireds(req.requireds);
    migrateRequireds(req.orRequireds);
  }
}

function toId(value: unknown): string {
  return typeof value === "object" && value !== null && "id" in value
    ? String((value as { id: unknown }).id)
    : String(value ?? "");
}

/** Migrate a selectable/regular addon (matches `initializeApp`'s addon pass). */
function migrateAddon(addon: Addon, parentId: string): void {
  const record = addon as unknown as Record<string, unknown>;
  if (typeof record.template === "undefined" || record.template === 0) record.template = 1;
  record.parentId = parentId;
  const sfxId = record.sfxId as string | undefined;
  if (typeof sfxId !== "undefined") {
    if (record.sfxOnSelect && typeof record.sfxIdOnSelect === "undefined")
      record.sfxIdOnSelect = sfxId;
    if (record.sfxOnDeselect && typeof record.sfxIdOnDeselect === "undefined")
      record.sfxIdOnDeselect = sfxId;
    delete record.sfxId;
  }
  migrateRequireds(addon.requireds);
  if (addon.isSelectable) migrateRequireds(addon.scores?.flatMap((score) => score.requireds ?? []));
}

/** Legacy projects infer section switches from the private styling keys. */
function migratePrivateStyling(data: Row | Choice): void {
  if (!data.isPrivateStyling || !data.styling) return;
  const record = data as unknown as Record<string, unknown>;
  const style = data.styling as Record<string, unknown>;
  const sections = {
    privateFilterIsOn: filterStyling,
    privateTextIsOn: textStyling,
    privateObjectImageIsOn: objectImageStyling,
    privateObjectIsOn: objectStyling,
    privateAddonImageIsOn: addonImageStyling,
    privateAddonIsOn: addonStyling,
    privateBackgroundIsOn: backgroundStyling,
    ...("objects" in data
      ? { privateRowImageIsOn: rowImageStyling, privateRowIsOn: rowStyling }
      : {}),
  };
  for (const [flag, defaults] of Object.entries(sections)) {
    if (record[flag] == null)
      record[flag] = Object.keys(defaults).some((key) =>
        Object.prototype.hasOwnProperty.call(style, key),
      );
  }
  if (record.privateAddonIsOn && style.useAddonDesign == null) style.useAddonDesign = true;
  if (record.privateAddonImageIsOn && style.useAddonImage == null) style.useAddonImage = true;
}

/** Migrate a choice (matches `initializeApp`'s object pass). */
function migrateChoice(choice: Choice, oldVersion: boolean, defaultAddonJustify: string): void {
  const record = choice as unknown as Record<string, unknown>;

  migratePrivateStyling(choice);
  if (choice.styling) initStylingMigration(choice.styling, oldVersion);
  if (choice.multiplyPointtypeIsOn) {
    if (typeof choice.pointTypeToMultiply === "string")
      choice.pointTypeToMultiply = [choice.pointTypeToMultiply];
    if (typeof choice.startingSumAtMultiply === "number") {
      choice.startingSumAtMultiply = [
        { value: choice.startingSumAtMultiply, calcVal: choice.startingSumAtMultiply },
      ] as Choice["startingSumAtMultiply"];
    }
  }
  if (choice.dividePointtypeIsOn) {
    if (typeof choice.pointTypeToDivide === "string")
      choice.pointTypeToDivide = [choice.pointTypeToDivide];
    if (typeof choice.startingSumAtDivide === "number") {
      choice.startingSumAtDivide = [
        { value: choice.startingSumAtDivide, calcVal: choice.startingSumAtDivide },
      ] as Choice["startingSumAtDivide"];
    }
  }

  // Old single fade-time -> in/out pair.
  if (
    (choice.isFadeTransition || record.fadeTransitionIsOn) &&
    typeof record.fadeTransitionTime !== "undefined"
  ) {
    const time = record.fadeTransitionTime as number;
    record.fadeInTransitionTime = time;
    record.fadeOutTransitionTime = time;
    delete record.fadeTransitionTime;
  }

  // Old single-target allow-choice -> list.
  if (choice.addToAllowChoice && typeof choice.idOfAllowChoice === "string") {
    choice.idOfAllowChoice = [choice.idOfAllowChoice];
  }

  if (Array.isArray(choice.groups)) choice.groups = choice.groups.map(toId);
  if (Array.isArray(choice.objectDesignGroups)) {
    choice.objectDesignGroups = choice.objectDesignGroups.map(toId);
  }

  // Deprecated per-choice aspect fields.
  if (typeof record.defaultAspectHeight !== "undefined") delete record.defaultAspectHeight;
  if (typeof record.defaultAspectWidth !== "undefined") delete record.defaultAspectWidth;

  if (
    choice.isSelectableMultiple &&
    typeof choice.numMultipleTimesMinus !== "undefined" &&
    typeof choice.initMultipleTimesMinus === "undefined"
  ) {
    choice.initMultipleTimesMinus = choice.forcedActivated ? 0 : choice.numMultipleTimesMinus;
  }

  // Old width strings / boolean defaultWidth flags.
  if (typeof record.width === "string") delete record.width;
  if (typeof record.defaultWidth === "boolean") delete record.defaultWidth;

  const sfxId = record.sfxId as string | undefined;
  if (typeof sfxId !== "undefined") {
    if (choice.sfxOnSelect && typeof choice.sfxIdOnSelect === "undefined")
      choice.sfxIdOnSelect = sfxId;
    if (choice.sfxOnDeselect && typeof choice.sfxIdOnDeselect === "undefined")
      choice.sfxIdOnDeselect = sfxId;
    delete record.sfxId;
  }

  if (!choice.addonJustify) {
    record.addonJustify = defaultAddonJustify;
  }

  migrateRequireds(choice.scores?.flatMap((score) => score.requireds ?? []));
  migrateRequireds(choice.requireds);
  for (const variant of choice.imageVariants ?? []) migrateRequireds(variant.requireds);
  for (const addon of choice.addons ?? []) migrateAddon(addon, choice.id);
}

/** Migrate a row (matches `initializeApp`'s row pass). */
function migrateRow(row: Row, oldVersion: boolean, defaultAddonJustify: string): void {
  const record = row as unknown as Record<string, unknown>;
  migratePrivateStyling(row);
  if (row.styling) initStylingMigration(row.styling, oldVersion);
  if (Array.isArray(row.rowDesignGroups)) row.rowDesignGroups = row.rowDesignGroups.map(toId);
  if (typeof record.width === "string") record.width = false;
  if (typeof record.defaultWidth === "boolean") delete record.defaultWidth;
  migrateRequireds(row.requireds);
  for (const choice of row.objects ?? []) migrateChoice(choice, oldVersion, defaultAddonJustify);
}

/** Migrate a row/object design group (matches `initializeApp`'s design-group pass). */
function migrateDesignGroup(group: RowDesignGroup | ObjectDesignGroup, oldVersion: boolean): void {
  if (typeof group.activatedId === "undefined") group.activatedId = "";
  if (typeof group.elements === "undefined") group.elements = [];
  if (typeof group.backpackElements === "undefined") group.backpackElements = [];
  if (typeof group.groupElements === "undefined") group.groupElements = [];
  group.elements = group.elements.map(toId);
  group.backpackElements = group.backpackElements.map(toId);
  group.groupElements = group.groupElements.map(toId);
  if (group.styling) initStylingMigration(group.styling, oldVersion);
}

/**
 * Replicates the document-level migrations the original ICCPlus editor applies
 * in `initializeApp()` when loading a saved project (`loadFromDisk`), so that
 * older or legacy ICCPlus documents behave identically in this port. Mutates
 * `app` in place and returns it.
 */
export function migrateApp(app: App): App {
  const oldVersion = typeof app.version === "undefined" || app.version === "2.0.0-beta";
  const defaultAddonJustify =
    ((app as unknown as Record<string, unknown>).defaultAddonJustify as string | undefined) ??
    "start";

  if (app.styling) initStylingMigration(app.styling, oldVersion, true);

  (app.backpack ?? []).forEach((row, i) => {
    row.index = i;
    row.isBackpack = true;
    migrateRow(row, oldVersion, defaultAddonJustify);
  });

  (app.rows ?? []).forEach((row, i) => {
    row.index = i;
    migrateRow(row, oldVersion, defaultAddonJustify);
  });

  for (const point of app.pointTypes ?? []) {
    const record = point as unknown as Record<string, unknown>;
    if (typeof point.initValue === "undefined" || point.initValue === null) {
      point.initValue = point.startingSum;
    }
    for (const key of ["positiveColor", "negativeColor", "privateColor", "privateNegativeColor"]) {
      const color = record[key];
      if (isPlainObject(color) && typeof color.hexa !== "undefined") {
        record[key] = color.hexa;
      }
    }
    if (typeof point.isNotShownObjects === "undefined" && point.activatedId) {
      point.isNotShownObjects = true;
    }
    if (typeof point.isNotShownPointBar === "undefined" && point.activatedId) {
      point.isNotShownPointBar = true;
    }
  }

  for (const group of app.groups ?? []) {
    group.elements = (group.elements ?? []).map(toId);
    group.rowElements = (group.rowElements ?? []).map(toId);
  }

  for (const g of app.globalRequirements ?? []) {
    g.requireds = g.requireds ?? [];
    migrateRequireds(g.requireds);
  }

  for (const word of app.words ?? []) {
    if (typeof word.replaceText === "undefined") word.replaceText = "";
  }

  for (const dg of app.rowDesignGroups ?? []) migrateDesignGroup(dg, oldVersion);
  for (const dg of app.objectDesignGroups ?? []) migrateDesignGroup(dg, oldVersion);

  return app;
}

/* ------------------------------------------------------------------ */
/* Image resources & ACL import translation                            */
/* ------------------------------------------------------------------ */

/** True when a string is a legacy inline image payload (data URL or URL). */
export function isInlineImageValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value !== "" &&
    !value.startsWith("image-") &&
    !value.startsWith("addon-") &&
    !value.startsWith("point-")
  );
}

/**
 * Resolve an image reference (an image resource id) against the document's
 * image resources. Legacy inline values pass through unchanged, so documents
 * written before the image-resource system keep rendering.
 */
export function resolveImageRef(app: App, ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const resource = (app.images ?? []).find((img) => img.id === ref);
  return resource?.image ? resource.image : ref;
}

/** Image-bearing fields shared by ICCPlus JSON and ZIP import. */
export function visitAppImageFields(
  document: unknown,
  visit: (record: Record<string, unknown>, key: string) => void,
  includeResources = false,
): void {
  const imageKeys = new Set([
    "image",
    "negativeImage",
    "bgImage",
    "defaultImage",
    "defaultBgImage",
    "backgroundImage",
    "rowBackgroundImage",
    "objectBackgroundImage",
    "addonBackgroundImage",
    "rowBorderImage",
    "objectBorderImage",
    "addonBorderImage",
    "backpackBgImage",
    "loadingBgImage",
  ]);
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (imageKeys.has(key) && typeof child === "string") visit(value, key);
      else if (key !== "preview" && key !== "planning" && (includeResources || key !== "images"))
        walk(child);
    }
  };
  walk(document);
}

/**
 * ACL import translation for the image-resource system.
 *
 * Old ICCPlus documents store entity images as inline strings (base64 data
 * URLs or remote URLs). The new system stores images as `app.images`
 * resources and entities reference them by id (like choices/rows reference
 * each other). This layer rewrites legacy inline values into resources on
 * import, deduplicating by payload so identical images share one resource.
 *
 * It is idempotent: values that are already image-resource ids are left
 * alone, so re-importing a translated document is a no-op. Re-export uses the
 * new format (the original ICCPlus editor is NOT re-import-compatible with
 * id references — only import of legacy files is supported).
 */
export function aclImportImages(app: App): App {
  const images: ImageResource[] = Array.isArray(app.images) ? [...app.images] : [];
  const existingIds = new Set(images.map((img) => img.id));
  const byPayload = new Map<string, string>();
  for (const img of images) {
    if (img.image) byPayload.set(img.image, img.id);
  }

  const newResourceId = (): string => {
    let id = newGenericId("image");
    while (existingIds.has(id)) id = newGenericId("image");
    existingIds.add(id);
    return id;
  };

  const ensure = (ref: unknown, tooltip?: unknown): unknown => {
    if (typeof ref !== "string" || ref === "") return ref;
    if (existingIds.has(ref)) return ref; // already a resource id
    if (!isInlineImageValue(ref)) return ref; // not a payload we own
    const existing = byPayload.get(ref);
    if (existing) return existing;
    const id = newResourceId();
    images.push({
      id,
      name: "",
      image: ref,
      imageIsURL: !ref.startsWith("data:"),
      sourceTooltip: typeof tooltip === "string" && tooltip ? tooltip : undefined,
    });
    byPayload.set(ref, id);
    return id;
  };

  visitAppImageFields(app, (record, key) => {
    record[key] = ensure(record[key], record.imageSourceTooltip ?? record.sourceTooltip);
  });

  app.images = images;
  return app;
}

/* ------------------------------------------------------------------ */
/* Summary helpers used by the UI and the agent                        */
/* ------------------------------------------------------------------ */

export interface AppSummary {
  version?: string;
  rowCount: number;
  choiceCount: number;
  addonCount: number;
  pointTypeCount: number;
  groupCount: number;
  globalRequirementCount: number;
  variableCount: number;
  wordCount: number;
  imageCount: number;
  title: string;
}

export function summarizeApp(app: App): AppSummary {
  let choiceCount = 0;
  let addonCount = 0;
  for (const row of app.rows ?? []) {
    choiceCount += row.objects?.length ?? 0;
    for (const choice of row.objects ?? []) {
      addonCount += choice.addons?.length ?? 0;
    }
  }
  return {
    version: app.version,
    rowCount: app.rows?.length ?? 0,
    choiceCount,
    addonCount,
    pointTypeCount: app.pointTypes?.length ?? 0,
    groupCount: app.groups?.length ?? 0,
    globalRequirementCount: app.globalRequirements?.length ?? 0,
    variableCount: app.variables?.length ?? 0,
    wordCount: app.words?.length ?? 0,
    imageCount: app.images?.length ?? 0,
    title: app.viewerConfig?.title ?? "Untitled CYOA",
  };
}

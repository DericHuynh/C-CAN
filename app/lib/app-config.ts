const rawAppName = "iccplus-agent-native";
const rawAppTitle = "ICCPlus CYOA Studio";

const APP_NAME_PLACEHOLDER = "{" + "{APP_NAME}}";
const APP_TITLE_PLACEHOLDER = "{" + "{APP_TITLE}}";

export const APP_NAME = rawAppName === APP_NAME_PLACEHOLDER ? "chat" : rawAppName;

export const APP_TITLE = rawAppTitle === APP_TITLE_PLACEHOLDER ? "Chat" : rawAppTitle;

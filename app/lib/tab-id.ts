import { getBrowserTabId } from "@agent-native/core/client/hooks";

// Share the same tab identity as the chat, navigation, and viewer capture bridge.
export const TAB_ID = getBrowserTabId();

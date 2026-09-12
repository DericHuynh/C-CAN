import * as Y from "yjs";

/** Keep the local selection attached to shared characters during remote edits. */
export function captureLiveCaret(text: Y.Text) {
  if (typeof document === "undefined") return null;
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return null;
  let start: number, end: number;
  const input = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
  if (input) {
    if (input.selectionStart === null || input.selectionEnd === null) return null;
    start = input.selectionStart;
    end = input.selectionEnd;
  } else if (el.isContentEditable) {
    const selection = window.getSelection();
    if (
      !selection?.rangeCount ||
      !el.contains(selection.anchorNode) ||
      !el.contains(selection.focusNode)
    )
      return null;
    const selected = selection.getRangeAt(0);
    const prefix = document.createRange();
    prefix.selectNodeContents(el);
    prefix.setEnd(selected.startContainer, selected.startOffset);
    start = prefix.toString().length;
    end = start + selected.toString().length;
  } else return null;
  const from = Y.createRelativePositionFromTypeIndex(text, Math.min(start, text.length));
  const to = Y.createRelativePositionFromTypeIndex(text, Math.min(end, text.length));
  return () => {
    if (document.activeElement !== el || !text.doc) return;
    const a = Y.createAbsolutePositionFromRelativePosition(from, text.doc)?.index;
    const b = Y.createAbsolutePositionFromRelativePosition(to, text.doc)?.index;
    if (a === undefined || b === undefined) return;
    if (input) input.setSelectionRange(a, b);
    else {
      const position = (offset: number): [Node, number] => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (offset <= (node.textContent?.length ?? 0)) return [node, offset];
          offset -= node.textContent?.length ?? 0;
        }
        return [el, el.childNodes.length];
      };
      const range = document.createRange();
      range.setStart(...position(a));
      range.setEnd(...position(b));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };
}

import { SharedRichEditor, type SharedRichEditorProps } from "@agent-native/toolkit/editor";
import { useCallback, useEffect, useRef } from "react";
import "@agent-native/toolkit/editor.css";
import { sanitizeHtml } from "./cyoa-styles";

const features = {
  markdown: false,
  image: false,
  tables: true,
  tasks: true,
  link: true,
  codeBlock: false,
};
const readHtml: NonNullable<SharedRichEditorProps["getMarkdown"]> = (editor) => editor.getHTML();
const setHtml: NonNullable<SharedRichEditorProps["setContent"]> = (editor, value, options) => {
  // Keep the CYOA's HTML representation instead of round-tripping through Markdown.
  const html = /<[a-z][\s\S]*>/i.test(value)
    ? value
    : value
        .split("\n")
        .map(
          (line) =>
            `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`,
        )
        .join("");
  editor.commands.setContent(sanitizeHtml(html), { emitUpdate: options.emitUpdate ?? false });
};

export function PlanningProseEditor({
  value,
  onChange,
  label,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  disabled: boolean;
}) {
  const editorRef = useRef<
    Parameters<NonNullable<SharedRichEditorProps["onEditorReady"]>>[0] | null
  >(null);
  const lastHtml = useRef<string | undefined>(undefined);
  const valueRef = useRef(value);
  valueRef.current = value;
  const ready = useCallback<NonNullable<SharedRichEditorProps["onEditorReady"]>>((editor) => {
    if (editor.isDestroyed || editorRef.current === editor) return;
    editorRef.current = editor;
    // Seed synchronously: the shared editor's deferred custom-format reconcile
    // can otherwise emit its initial empty paragraph when editability changes.
    setHtml(editor, valueRef.current, { emitUpdate: false });
    lastHtml.current = editor.getHTML();
  }, []);
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed && editor.getHTML() !== value) {
      // Explicit local recovery/source/reload values are authoritative in this
      // controlled draft, even without a collaboration timestamp.
      setHtml(editor, value, { emitUpdate: false });
      lastHtml.current = editor.getHTML();
    }
  }, [value]);
  return (
    <SharedRichEditor
      value={value}
      onChange={(html) => {
        // Ignore queued emissions from initialization or an obsolete document.
        if (editorRef.current?.getHTML() === html && lastHtml.current !== html) {
          lastHtml.current = html;
          onChange(html);
        }
      }}
      onEditorReady={ready}
      ariaLabel={label}
      placeholder={placeholder}
      features={features}
      dragHandle={false}
      editable={!disabled}
      getMarkdown={readHtml}
      setContent={setHtml}
      parseValue={false}
      className="min-w-0 rounded-md border bg-background [&_.tiptap]:min-h-48 sm:[&_.tiptap]:min-h-64"
      editorClassName="min-h-64 px-5 py-4 text-base leading-relaxed"
    />
  );
}

import { EditorWorkspace, useEditorMachine, type EditorSnapshot } from "@airdesign/ui";

export function Editor({ initial }: { initial: EditorSnapshot }) {
  const [snapshot, send] = useEditorMachine(initial);
  return <EditorWorkspace snapshot={snapshot} send={send} />;
}

export { Editor as EditorApp };

import { EditorWorkspace, useEditorMachine, type EditorSnapshot } from "@airdesign/ui";

export function Editor({
  initial,
  draftProgress,
  onDraft,
}: {
  initial: EditorSnapshot;
  draftProgress?: number;
  onDraft?: (prompt: string) => void;
}) {
  const [snapshot, send] = useEditorMachine(initial);
  return (
    <EditorWorkspace
      snapshot={snapshot}
      send={send}
      draftProgress={draftProgress}
      onDraft={onDraft}
    />
  );
}

export { Editor as EditorApp };

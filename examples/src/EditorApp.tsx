import {
  EditorWorkspace,
  useEditorMachine,
  type EditorSnapshot,
  type PresentSlideItem,
} from "@airdesign/ui";

export function Editor({
  initial,
  draftProgress,
  onDraft,
  slideItems,
}: {
  initial: EditorSnapshot;
  draftProgress?: number;
  onDraft?: (prompt: string, api: { setProgress(n: number): void; done(): void }) => void;
  slideItems?: PresentSlideItem[];
}) {
  const [snapshot, send] = useEditorMachine(initial);
  return (
    <EditorWorkspace
      snapshot={snapshot}
      send={send}
      draftProgress={draftProgress}
      onDraft={onDraft}
      slideItems={slideItems}
    />
  );
}

export { Editor as EditorApp };

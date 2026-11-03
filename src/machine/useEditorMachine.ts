import { useMachine } from "./createMachine.js";
import { editorMachine, type EditorContext, type EditorEvent, type EditorSnapshot } from "./editorMachine.js";

/**
 * Convenience hook that binds `editorMachine` to React via `useMachine`.
 * Accepts an optional snapshot from `editorMachine.restore()`.
 */
export function useEditorMachine(start?: EditorSnapshot) {
  return useMachine<EditorContext, EditorEvent>(editorMachine, start);
}

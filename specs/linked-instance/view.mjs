const steps = {
  Update: "update data or rebuild a stale undo against it",
  Delete: "delete a generated part",
  PersonUndo: "undo a part delete on the device",
  AgentUndo: "undo the agent run",
  ChangeInputs: "update linked data",
  SuppressBar: "delete another writer's bar",
  OverwriteInputs: "replace linked data in another tab",
  UndoUpdate: "undo a data update",
  QueueUndoRun: "send a run undo",
  RaceRun: "rename the slide while the run undo is in flight",
  UndoRun: "finish the run undo",
  Redo: "redo a part delete on the device",
}

export const title = "Update and undo a linked instance across writers"
export const group = () => title
export const state = (v) =>
  `rows ${v.rows || "empty"}, suppression mask ${v.hidden}, person step ${v.person}, agent step ${v.agent}, redo ${v.redo}
  ${v.mode} update ${v.update}, raced ${v.raced}, rebuilt ${v.rebuilt}`
export const step = (action) => steps[action] ?? null

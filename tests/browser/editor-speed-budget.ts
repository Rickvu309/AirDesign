import { onCi } from "../browser-workers"

const localTiming = {
  idleTaskMilliseconds: 150,
  typeTaskPerKey: 8,
  typePreviewRender: 8,
  typePreviewPaint: 8,
  dragScriptPerFrame: 8,
  dragTaskPerFrame: 16,
  agentEditPaintMilliseconds: 72,
}

const ciTiming = {
  idleTaskMilliseconds: 8,
  typeTaskPerKey: 4,
  typePreviewRender: 2.6,
  typePreviewPaint: 3.1,
  dragScriptPerFrame: 2.7,
  dragTaskPerFrame: 8.6,
  agentEditPaintMilliseconds: 38,
}

export const editorSpeedBudget = (env: NodeJS.ProcessEnv) => ({
  slides: 40,
  idleLongTaskMilliseconds: 50,
  typeTaskBeyondTypical: 1.2,
  typeMeasureCalls: 6,
  typePreviewRedraws: 7,
  dragLongFrames: 0,
  ...(onCi(env) ? ciTiming : localTiming),
})

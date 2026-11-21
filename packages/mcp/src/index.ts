import { elementSuite } from "./element-suite.js"
import { slideSuite } from "./slide-suite.js"
import { readSuite } from "./read-suite.js"
import { setSuite } from "./set-suite.js"
import { suite as writtenSuite, type SuiteRow } from "./suite.js"

export { admit, emptyLog, refund, type Admission, type CallerLog, type LimitKind } from "./admit.js"
export { callTool, type AgentCaller, type Session, type ToolResult } from "./call-tool.js"
export { type CreatedDeck } from "./create-tool.js"
export { wantedSlides, type ReadPictures } from "./slide-pictures.js"
export { editLanded, editRefusal } from "./edit-answer.js"
export { editFindings } from "./edit-findings.js"
export { editNext, runNext, type EditCode } from "./edit-next.js"
export { imageAddresses, imagesPerCall, type ImageRefusal, type NamedImage } from "./named-image.js"
export { kindInstructions } from "./kind-refusal.js"
export { afterWrite, agentCaller } from "./run.js"
export { dropGoneTurn, liveTurn, memoryTurns, settleTurn, type Turn, type Turns } from "./turn.js"
export {
  edit,
  elements,
  score,
  type Attempt,
  type Answer,
  type Outcome,
  type Step,
  type Task,
  type Tool,
  type Write,
} from "./score.js"

export const suite: readonly SuiteRow[] = [...writtenSuite, ...readSuite, ...slideSuite, ...elementSuite, ...setSuite]

export { landSourceAttempt, landSourceTask, staleEditAttempt, staleEditTask, type SuiteRow } from "./suite.js"
export { commitTries, createServer, type Host, type Lost } from "./server.js"

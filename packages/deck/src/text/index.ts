export type {TextStyle, InlineRun, NumberFormat, ParagraphMarker, LineSpacing, Paragraph, TextFrame, TextBody} from "./body.ts"
export {parseTextBody, isParagraph, isTextFrame} from "./body-codec.ts"
export type {NativeText, NativeElement, NativeSlide, NativeDeck, NativeArchiveV3} from "./native-v3.ts"
export {parseNativeArchiveV3} from "./native-v3.ts"
export {paragraphNumbers} from "./numbering.ts"

export {parseNativeChangeSet, type NativeChangeSet, type NativeChange, type NativeValue} from "./operations.ts"

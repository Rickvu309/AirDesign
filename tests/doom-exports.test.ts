import { readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript-api"
import { expect, it } from "vitest"

const root = path.resolve(import.meta.dirname, "..")

const exportedNames = (file: string) => {
  const source = ts.createSourceFile(file, readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true)
  return source.statements
    .flatMap((statement) =>
      ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)
        ? statement.exportClause.elements.map((element) => element.name.text)
        : [],
    )
    .sort()
}

it("hands other packs only the Doom names they import", () => {
  expect(exportedNames("packages/doom/src/index.ts")).toEqual(
    `Align9 Author Bake Bounds Box Clipboard Color ColorVar Copies Corners Direction Doom Edit End Expectation Face FaceNeeds FontFace FontWidths
    Geometry GridShortfall Grown Hex ImageCrop ImagePaint Intent IntentEdit IntentRefusal IntentSession IntentWrites LandBy
    Landed Landing LayerPositions Layout LayoutProblem Matrix Measure MeasureLayout MeasureProbe MediaType MissingGlyphs
    Node NodeId NodeKind NodeType OrderKey Paint Para PlacedBox PlacementRules Point Pressed ProblemRules PropName Props Refusal Replaced
    Resolved ResolvedEffect ResolvedLine ResolvedPaint ResolvedRun Rev RevisionKey RunEdit Sides Site
    SlideStart Span StartRules StrokeStyle Text TextPatch TextStyleName Theme ThemeProblem TreeNode TreeSlide UndoBy
    Undoable Undoing Undone Write WriteKey adjustDefaults applyEdit applyMatrix artMatrix bakeLayout bakeTextLayers
    boxMatrix bytesOf charsByFace childrenOf contentAreaOf contentMatrix copiedMove countsOf coverCrop cropSides deckName
    deckNameFollows deckOf deckTexts descendantsOf doomFaces doomFromTree duplicateWrites emptyDoom familyOf fitShift
    flows fontFace fontSamples freeLineEnds freedEnds gapFor graphemes hasDeck holdsLineEnd holdsText identityMatrix
    intentSession intentWrites intentsSchema invertMatrix isLaidOut isLive isRefusal land landEdit layerKind layoutProblems
    leavingRoots limits lineArrowheads liveRuns lockedIn lookFieldsOf lookNames lookWrite lostBy mayLeaveDeck measureWith measureWithLayout
    mediaSize mediaTypeOf mediaTypes missingGlyphsIn moveToSlide nodeId nodeKinds notesText onDeck onTop orderKeyBetween
    overPixelLimit paintedFace paletteColorVars paraWrite paragraphAligns parentOf parseTheme pasteWrites pictureFit placeBox placeSlide
    presetHolds presetOutline propOf props readColor readEdit readFold readIntent readLanded readLinkAddress readNodeId
    readRunEdit readRuns readStoredNode reorderWrites replacedBy resolveColor resolveSlide returningRoots rev revsToJson routeDistance
    runsToJson sameColor sameValue shapeNames siteSpot slideBackground slideGroups slideKeyText slideOf
    slideStartWrites slideStarts slidesOf solveLayout storedFace strokeDash styleWrite
    textArea textFont textFromMarkdown textLimits textToMarkdown tinted titleSlideWrites touchedSlides undo unfittedBox
    uniformAlign uniformColor unmeasuredTexts viewOf wrapDegrees wrapRotation`.split(/\s+/),
  )
})

it("hands tests and the bench the Doom names only they import, behind @airdesign/doom/testing", () => {
  expect(exportedNames("packages/doom/src/testing/index.ts")).toEqual(
    `IntentColor Run Tree agentReadFixture board boardDeckIntents colorVars compileIntent compileIntents foldToJson invert
    invertRun placement starts testTheme`.split(/\s+/),
  )
})

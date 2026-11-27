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
    `AgentChange AgentEdit AgentFinding AgentRefusal AgentSession Align9 Author Bake Box Clipboard Color ColorVar Copies
    Doom Edit End Face FaceNeeds FontFace FontWidths Geometry Grown Hex ImageCrop ImagePaint Keyed Landed LayerPositions
    Layout LayoutFinding Matrix Measure MeasureLayout MeasureProbe MediaType MissingGlyphs Node NodeId NodeType OrderKey
    Paint Para Point PropName Props Refusal Replaced Resolved ResolvedEffect ResolvedLine ResolvedPaint ResolvedRun Rev
    RevisionKey RunEdit RunUndo Site SlideGroup SlideStart Span StrokeStyle Text TextPatch TextStyleName Theme TreeNode
    TreeSlide Undone Write WriteKey adjustDefaults agentChangesSchema agentEditSession agentKind applyEdit applyMatrix
    artMatrix bakeLayout bakeTextLayers blankDeckName boxMatrix bytesOf changingWrites charsByFace childrenOf
    contentAreaOf contentMatrix copiedMove countsOf coverCrop deckName deckNameFollows deckOf deckTexts defaultTheme
    descendantsOf doomFaces doomFromTree duplicateWrites emptyDoom familyOf fitShift flows fontFace fontSamples
    freeLineEnds freedEnds gapFor graphemes hasDeck holdsLineEnd holdsText identityMatrix invert invertMatrix invertRun
    isRefusal landEdit layoutFindings leavingRoots limits lineArrowheads lineEndsBack liveRuns lockedIn lookWrite lostBy
    mayLeaveDeck measureWith measureWithLayout mediaSize mediaTypeOf mediaTypes missingGlyphsIn moveToSlide
    nameFromTitleWrites nodeId notesText onDeck onStandingLayers onTop orderKeyBetween overPixelLimit paintedFace
    paletteColorVars paraWrite paragraphAligns parentOf parseTheme pasteWrites pictureFit presetHolds presetOutline
    propOf props readAgentChange readColor readEdit readFold readForAgent readLanded readLinkAddress readNodeId
    readRunEdit readRuns readStoredNode replacedBy resolveColor resolveSlide returningRoots rev revsToJson routeDistance
    runsToJson sameColor sameValue shapeNames siblingKeys siteSpot slideBackground slideGroups slideKeyText slideOf
    slidePlacementWrites slideRowAt slideStartWrites slideStarts slidesOf solveLayout storedFace strokeDash styleWrite
    textArea textFont textFromMarkdown textLimits tinted titleSlideWrites touchedSlides unfittedBox unmeasuredTexts
    viewOf wrapDegrees wrapRotation`.split(/\s+/),
  )
})

it("hands tests and the bench the Doom names only they import, behind @airdesign/doom/testing", () => {
  expect(exportedNames("packages/doom/src/testing/index.ts")).toEqual(
    `AgentColor Run Tree boardDeckChanges colorVars compileAgentChange compileAgentEdit foldToJson placeholderSubtitle
    placeholderTitle textToMarkdown`.split(/\s+/),
  )
})

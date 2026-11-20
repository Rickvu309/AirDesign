# Text

How a person sets the look of letters and lists. Figma Slides' words.

## Language

**weight**:
How heavy a family's letters are, from Thin (100) to Black (900), each upright or italic, as the Weight list in the design panel names them. The list shows only the weights the family's files on our server hold. Regular and Bold are the family itself with the run's `bold` flag off or on; every other weight is its named face. Option Command > and < (Ctrl Alt > and < elsewhere) step a layer, or the selected words while typing, to the next weight. While typing, the Weight field shows and sets the selected words' weight. A family picked before its files load keeps the weight once they load when it holds it, and falls back to Regular when it does not.
_Avoid_: font style, boldness

**named face**:
The typeface that holds a weight other than Regular or Bold: the family's name and the weight's, such as `Inter SemiBold`. A run stores it as its `font`, and a PowerPoint file keeps it as the run's typeface, the name Windows gives that weight. An imported deck's names stay as they were written.
_Avoid_: portable face

**list level**:
How deep a list item sits, from the first level to the fifth as Figma allows; a PowerPoint file holds nine and keeps an imported deeper level. Tab or Ctrl ] (Command ] on a Mac) indents the item under the caret and Shift Tab or Ctrl [ outdents it; Return on an empty indented item outdents it. A run stores it as its paragraph's `level`, and a PowerPoint file keeps it as `lvl` with that level's own `marL` and `indent`: the marker on a half-inch tab stop per level, the text hung 22.5 points after a bullet and half an inch after a number. In a text box, bullets stay • at every level; numbers turn to letters, then roman numerals. In a placeholder whose template sets that level's indent, the item takes the template's indent instead and the file keeps only `lvl`, so it lines up with the template's own items; an item with no bullet of its own shows the template level's bullet, as PowerPoint does.
_Avoid_: indent level, outline level, nesting

**Auto** (line height):
A line height of PowerPoint's single line, 100%: the font's own spacing, as Figma's Auto is. The Line height field shows Auto there and reads a typed Auto. Line height and Letter spacing also read a typed `%` or `pt`. In Letter spacing, points turn into the field's percent of the type size; in Line height they make a fixed line height.

**fixed line height**:
A line height in points that stays the same when the type size changes, as Figma's line height in pixels does. Typing `24pt` into Line height sets one, and the field then shows `24 pt` and reads a bare number as points until a `%` or Auto is typed. A paragraph stores it as `lineHeightPoints` in hundredths of a point, and a PowerPoint file keeps it as `lnSpc` with `spcPts`; an imported `spcPts` shows in the field the same way.
_Avoid_: exact line spacing, absolute line height

**text resizing**:
How a text layer's box follows its words, with Figma's three names. **Auto width** grows and shrinks the box both ways as a person types, one line long; **Auto height** keeps the width and grows or shrinks the height; **Fixed size** keeps both, and words that do not fit draw past the box. A PowerPoint file keeps them in `bodyPr`: Auto width is `wrap="none"` with `spAutoFit`, Auto height is `wrap="square"` with `spAutoFit`, Fixed size has no autofit. The open tab measures the words and saves the box it draws as a row that sets only the box's height, or its width and height (`measuredOnly`), which neither guards a run nor counts as the person's writing. An imported box keeps its file's size until someone edits it.
_Avoid_: autosize, shrink-wrap

**Text tool**:
The tool T or Add text arms, as Figma's Text tool. A click on the slide places Auto width text with its top left at the click, a drag of three pixels or more draws a Fixed size box, and either goes back to Move. Esc or V puts the tool down. In grid view Add text still adds text to the chosen slide at once. Resizing a text layer's box by hand makes it Fixed size, in the same undo step, as Figma does.
_Avoid_: text box tool, insert text

**text layer inset**:
The room between a text layer's box and its words. Text a person or an agent adds in AirDesign has none, as a Figma text layer has no padding, and its file writes `lIns="0" tIns="0" rIns="0" bIns="0"` so PowerPoint does not add its 7.2 pt and 3.6 pt. Imported text keeps its own inset.
_Avoid_: padding, margin (the design panel's Margins fields set it)

# Text

How a person sets the look of letters and lists. Figma Slides' words.

## Language

**weight**:
How heavy a family's letters are, from Thin (100) to Black (900), each upright or italic, as the Weight list in the design panel names them. The list shows only the weights the family's files on our server hold. Regular and Bold are the family itself with the run's `bold` flag off or on; every other weight is its named face. Option Command > and < (Ctrl Alt > and < elsewhere) step a layer, or the selected words while typing, to the next weight. While typing, the Weight field shows and sets the selected words' weight. Ctrl+B on a named face paints Bold, that family's bold face, and a second press returns to the named face. A family picked before its files load keeps the weight once they load when it holds it, and falls back to Regular when it does not.
_Avoid_: font style, boldness

**named face**:
The typeface that holds a weight other than Regular or Bold: the family's name and the weight's, such as `Inter SemiBold`. A run stores it as its `font`.
_Avoid_: portable face

**list level**:
How deep a list item sits, from the first level to the fifth as Figma allows. Tab or Ctrl ] (Command ] on a Mac) indents the item under the caret and Shift Tab or Ctrl [ outdents it; Return on an empty indented item outdents it. A run stores it as its paragraph's `level`. In a text box, bullets stay • at every level; numbers turn to letters, then roman numerals. In a placeholder whose template sets that level's indent, the item takes the template's indent instead; an item with no bullet of its own shows the template level's bullet, as PowerPoint does.
_Avoid_: indent level, outline level, nesting

**Auto** (line height):
The font's default line spacing at 100%. The Line height field displays Auto and accepts it as input. Line height and Letter spacing also read a typed `%` or `pt`. In Letter spacing, points turn into the field's percent of the type size; in Line height they make a fixed line height.

**fixed line height**:
A line height in points that stays the same when the type size changes, as Figma's line height in pixels does. Typing `24pt` into Line height sets one, and the field then shows `24 pt` and reads a bare number as points until a `%` or Auto is typed. A paragraph stores it as `lineHeightPoints` in hundredths of a point..
_Avoid_: exact line spacing, absolute line height

**text resizing**:
How a text layer's box follows its words, with Figma's three names. **Auto width** grows and shrinks the box both ways as a person types, one line long; **Auto height** keeps the width and grows or shrinks the height; **Fixed size** keeps both, and words that do not fit draw past the box. The open tab measures the words and saves the box it draws as a row that sets only the box's height, or its width and height (`measuredOnly`), which neither guards a run nor counts as the person's writing.
_Avoid_: autosize, shrink-wrap

**Text tool**:
The tool T or Add text arms, as Figma's Text tool. A click on the slide places Auto width text with its top left at the click, a drag of three pixels or more draws a Fixed size box, and either goes back to Move. Esc or V puts the tool down. A drag snaps both corners as a resize does, with red guides along the box's edges, and Control turns it off; a click lands where it is. Resizing a text layer's box by hand makes it Fixed size, in the same undo step, as Figma does.
_Avoid_: text box tool, insert text

**placed text**:
Text the Text tool placed that has no characters yet. It lives only in the open tab: no undo step, no stored edit, nothing sent. Its first character stores the add, in one undo step, and the typing after it is the next step. When editing ends with no characters, by Escape or a click away from its words, it is removed and focus stays on the slide, as Figma and PowerPoint remove an empty text box. A click into a panel that keeps the selection does not end editing. Each placed text takes its own element, even while the tab is still storing earlier edits, so text placed quickly one after another never shares a box, and each keeps the words typed in it.
_Avoid_: draft text, pending text

**emptied text**:
A saved text layer whose words a person deleted, or an agent set to none. When the person's editing ends, by Escape or a click away from its words, it is removed, as Figma removes an empty text layer; an agent's emptied text is removed in the same run. The removal takes the typing that emptied it into one undo step, so one Undo brings the layer back with its words, and text typed and emptied in one visit leaves no step. A placeholder stays, as PowerPoint keeps an empty one, and so does a shape with a fill, a border or a geometry other than a rectangle.
_Avoid_: blank text, cleared text

**text layer inset**:
The room between a text layer's box and its words. Text a person or an agent adds in AirDesign has none by default.
_Avoid_: padding, margin (the design panel's Margins fields set it)

**fallback font**:
Geist, the family that paints grapheme clusters the run’s font lacks and clusters in a family the server does not serve. The canvas, the filmstrip and the server’s measure use the same stack, with text normalized to NFC for measuring. The canvas can paint clusters from a system font when the stack cannot cover them. An agent’s layout none refuses to bake measured text inside the frame when the fonts are pending, the stack cannot cover it or the text needs contextual shaping, including Hangul and emoji sequences. Text with the U+FE0E text-presentation selector is also refused.
_Avoid_: default font, system font (the machine's own fonts, which nothing measures)

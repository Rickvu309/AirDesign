# Text

How a person sets the look of letters and lists. Figma Slides' words.

## Language

**weight**:
How heavy a family's letters are, from Thin (100) to Black (900), each upright or italic, as the Weight list in the design panel names them. The list shows only the weights the family's files on our server hold. Regular and Bold are the family itself with the run's `bold` flag off or on; every other weight is its named face. Option Command > and < (Ctrl Alt > and < elsewhere) step a layer to the next weight.
_Avoid_: font style, boldness

**named face**:
The typeface that holds a weight other than Regular or Bold: the family's name and the weight's, such as `Inter SemiBold`. A run stores it as its `font`, and a PowerPoint file keeps it as the run's typeface, the name Windows gives that weight. An imported deck's names stay as they were written.
_Avoid_: portable face

**list level**:
How deep a list item sits, from the first level to the fifth as Figma allows; a PowerPoint file holds nine and keeps an imported deeper level. Tab or Ctrl ] (Command ] on a Mac) indents the item under the caret and Shift Tab or Ctrl [ outdents it; Return on an empty indented item outdents it. A run stores it as its paragraph's `level`, and a PowerPoint file keeps it as `lvl` with that level's own `marL` and `indent`: the marker on a half-inch tab stop per level, the text hung 22.5 points after a bullet and half an inch after a number. Bullets stay • at every level; numbers turn to letters, then roman numerals.
_Avoid_: indent level, outline level, nesting

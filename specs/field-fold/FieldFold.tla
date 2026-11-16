---- MODULE FieldFold ----
\* How one element's design panel fields fold. The element is a shape whose file fill has its own
\* colour and its own transparency, whose style names a theme colour it inherits when its fill is
\* reset, and whose text sets no size, so it paints the size its master gives it.
\* Three fields: the fill's colour (fill.value), its transparency (the element's Opacity, written to
\* the alpha of its fill, line and text) and the text's size (written as the whole text value).
\* A row sets one of them, sends the colour back to inherit (Reset fill), or sends a field back to
\* the file's own value ("opening"); a node shows its rows folded field by field (netPatch in
\* packages/document/src/row.ts). The export writes that fold over the file's own bytes
\* (exportParts in packages/pptx), and the panel and the canvas both read what the export wrote.
\* The person clicks Reset fill, then sets one field (the colour, the opacity or the size), then
\* clicks Undo twice. Each click plans against the deck on the device, writes a pending row,
\* records its undo step and paints (applyChange in apps/web/src/design/trait-edit.ts). An agent
\* sets the colour or the opacity on the server in one run, or changes the theme colour the style
\* names, so the inherited colour above the element changes. Sync is the device sending its
\* pending rows, the server applying them after the rows it already holds, and the device reading
\* the server's deck back.
\* An edit is a digit, and the digit names its field:
\*   colour       1 the file's, 2 inherit (Reset fill), 3 the person's, 4 the agent's
\*   transparency 5 the file's, 6 the person's, 7 the agent's
\*   size         8 the file's, 9 the person's
\* Rows are numbers whose digits are their edits, the first row first. An undo step is two
\* digits, the edit before it and the edit after it, and the undo list is the number whose base-100
\* digits are its steps, the top one last.
EXTENDS Integers

VARIABLES made, second, turns, log, seen, pending, agent, theme, dTheme, undo, told,
          dColour, dAlpha, dSize, sColour, sAlpha, sSize, colour, alpha, size, quiet, bytes

vars == <<made, second, turns, log, seen, pending, agent, theme, dTheme, undo, told,
          dColour, dAlpha, dSize, sColour, sAlpha, sSize, colour, alpha, size, quiet, bytes>>

RECURSIVE Digits(_)
Digits(n) == IF n = 0 THEN 0 ELSE 1 + Digits(n \div 10)

Cat(a, b) == a * 10 ^ Digits(b) + b
Prefix(n, k) == n \div 10 ^ (Digits(n) - k)

FieldOf(edit) == IF edit <= 4 THEN 1 ELSE IF edit <= 7 THEN 2 ELSE 3
FileEdit(field) == CASE field = 1 -> 1 [] field = 2 -> 5 [] OTHER -> 8

\* A field shows the last row that names it, and the file's own value when no row does.
RECURSIVE Fold(_, _)
Fold(rows, field) ==
  IF rows = 0 THEN FileEdit(field)
  ELSE IF FieldOf(rows % 10) = field THEN rows % 10
  ELSE Fold(rows \div 10, field)

\* The device's deck: the server's rows as the device last read them, its pending rows on top.
DeviceRows == Cat(Prefix(log, seen), pending)

\* What the export writes, so what the panel and the canvas show. A reset fill is the inherited
\* fill as a whole, so its transparency is the inherited one unless a row sets the transparency.
\* An agent's colour keeps the transparency of the bytes it is written over, which are the file's.
\* The person's colour picked over the inherited fill is written at the transparency the panel
\* showed, so it keeps the inherited one; picked over the agent's colour it keeps the file's.
ShownColour(c) == CASE c = 1 -> "file" [] c = 2 -> "inherited" [] c = 3 -> "person" [] OTHER -> "agent"
ShownAlpha(a, c, under) ==
  CASE a = 6 -> "person" [] a = 7 -> "agent" [] c = 2 \/ (c = 3 /\ under = 2) -> "inherited" [] OTHER -> "file"

\* The colour the person's colour step replaced, read from the undo list. While the device shows
\* the person's colour, that step is still on the list.
RECURSIVE ColourUnder(_)
ColourUnder(list) ==
  IF list = 0 THEN 0 ELSE IF list % 10 = 3 THEN (list % 100) \div 10 ELSE ColourUnder(list \div 100)
ShownSize(s) == IF s = 9 THEN "person" ELSE "inherited"

Show ==
  LET rows == Cat(Prefix(log', seen'), pending')
      c == Fold(rows, 1)
      a == Fold(rows, 2)
      s == Fold(rows, 3)
  IN /\ dColour' = c
     /\ dAlpha' = a
     /\ dSize' = s
     /\ sColour' = Fold(log', 1)
     /\ sAlpha' = Fold(log', 2)
     /\ sSize' = Fold(log', 3)
     /\ colour' = ShownColour(c)
     /\ alpha' = ShownAlpha(a, c, ColourUnder(undo'))
     /\ size' = ShownSize(s)
     /\ quiet' = (c = 2 /\ a = 5)
     /\ bytes' = (c = 1 /\ a = 5 /\ s = 8)

TypeOK ==
  /\ made \in 0..2
  /\ second \in {"none", "colour", "alpha", "size"}
  /\ turns \in 0..2
  /\ log \in 0..99999
  /\ seen \in 0..Digits(log)
  /\ pending \in 0..9999
  /\ agent \in {"none", "colour", "alpha", "theme"}
  /\ theme \in 1..2
  /\ dTheme \in 1..2
  /\ undo \in 0..9999
  /\ told \in 0..3
  /\ dColour \in 1..4 /\ sColour \in 1..4
  /\ dAlpha \in 5..7 /\ sAlpha \in 5..7
  /\ dSize \in 8..9 /\ sSize \in 8..9
  /\ colour \in {"file", "inherited", "person", "agent"}
  /\ alpha \in {"file", "inherited", "person", "agent"}
  /\ size \in {"inherited", "person"}
  /\ quiet \in BOOLEAN
  /\ bytes \in BOOLEAN

Init ==
  /\ made = 0
  /\ second = "none"
  /\ turns = 0
  /\ log = 0
  /\ seen = 0
  /\ pending = 0
  /\ agent = "none"
  /\ theme = 1
  /\ dTheme = 1
  /\ undo = 0
  /\ told = 0
  /\ dColour = 1 /\ dAlpha = 5 /\ dSize = 8
  /\ sColour = 1 /\ sAlpha = 5 /\ sSize = 8
  /\ colour = "file" /\ alpha = "file" /\ size = "inherited"
  /\ quiet = FALSE
  /\ bytes = TRUE

\* A click writes one pending row and records its step, before what the device showed and after
\* what it wrote.
Click(edit, before) ==
  /\ pending' = pending * 10 + edit
  /\ undo' = undo * 100 + before * 10 + edit
  /\ told' = 0

\* Reset fill is on offer while the fill is the element's own.
Reset ==
  /\ made = 0
  /\ ~quiet
  /\ made' = 1
  /\ Click(2, dColour)
  /\ UNCHANGED <<second, turns, log, seen, agent, theme, dTheme>>
  /\ Show

Set(edit, before) ==
  /\ made = 1
  /\ made' = 2
  /\ Click(edit, before)
  /\ UNCHANGED <<turns, log, seen, agent, theme, dTheme>>
  /\ Show

SetColour == second' = "colour" /\ Set(3, dColour)
SetAlpha == second' = "alpha" /\ Set(6, dAlpha)
SetSize == second' = "size" /\ Set(9, dSize)

\* Undo lands the edit before the top step while the device still shows the edit after it.
\* Otherwise nothing changes, the step leaves the list, and the person is told.
Undo ==
  /\ made = 2
  /\ turns < 2
  /\ turns' = turns + 1
  /\ LET top == undo % 100
         before == top \div 10
         after == top % 10
     IN IF Fold(DeviceRows, FieldOf(after)) = after
        THEN /\ pending' = pending * 10 + before
             /\ told' = 0
        ELSE /\ told' = FieldOf(after)
             /\ UNCHANGED pending
  /\ undo' = undo \div 100
  /\ UNCHANGED <<made, second, log, seen, agent, theme, dTheme>>
  /\ Show

\* An agent's run sets one field on the server. The device reads it at the next sync.
Agent(edit) ==
  /\ agent = "none"
  /\ log' = log * 10 + edit
  /\ UNCHANGED <<made, second, turns, seen, pending, theme, dTheme, undo, told>>
  /\ Show

AgentColour == agent' = "colour" /\ Agent(4)
AgentAlpha == agent' = "alpha" /\ Agent(7)

\* An agent's run changes the theme colour the style names, so a reset fill inherits another
\* colour. The device reads it at the next sync.
AgentTheme ==
  /\ agent = "none"
  /\ agent' = "theme"
  /\ theme' = 2
  /\ UNCHANGED <<made, second, turns, log, seen, pending, dTheme, undo, told>>
  /\ Show

\* The server applies the pending rows after the rows it holds, and the device reads its deck.
Sync ==
  /\ pending # 0 \/ seen < Digits(log) \/ dTheme # theme
  /\ log' = Cat(log, pending)
  /\ seen' = Digits(log')
  /\ pending' = 0
  /\ dTheme' = theme
  /\ UNCHANGED <<made, second, turns, agent, theme, undo, told>>
  /\ Show

Next ==
  \/ Reset \/ SetColour \/ SetAlpha \/ SetSize \/ Undo
  \/ AgentColour \/ AgentAlpha \/ AgentTheme \/ Sync

Spec == Init /\ [][Next]_vars

\* One row added on the device, or one on the server, and nothing else moved.
OnDevice(edit) == pending' = pending * 10 + edit /\ log' = log /\ seen' = seen
OnServer(edit) == log' = log * 10 + edit /\ pending' = pending /\ seen' = seen

\* A row changes the fold of the field it names and of no other, on the device and on the server.
\* So a colour never resets the transparency, a transparency never resets the colour, and neither
\* touches the size.
FoldsApart ==
  [][\A edit \in 1..9 :
       (OnDevice(edit) \/ OnServer(edit)) =>
         /\ FieldOf(edit) # 1 => dColour' = dColour /\ sColour' = sColour
         /\ FieldOf(edit) # 2 => dAlpha' = dAlpha /\ sAlpha' = sAlpha
         /\ FieldOf(edit) # 3 => dSize' = dSize /\ sSize' = sSize]_vars

\* A transparency row never changes the colour or the size the panel and the canvas show, and a
\* size row never changes the colour or the transparency.
ShownApart ==
  [][\A edit \in 5..9 :
       OnDevice(edit) =>
         /\ colour' = colour
         /\ FieldOf(edit) = 2 => size' = size
         /\ FieldOf(edit) = 3 => alpha' = alpha]_vars

\* The person's new colour keeps the transparency the panel and the canvas showed.
ColourKeepsAlpha == [][OnDevice(3) => alpha' = alpha]_vars

\* A reset colour shows and paints the inherited colour, in quiet ink while no row sets the
\* transparency.
ClearShowsInherited ==
  /\ dColour = 2 => colour = "inherited"
  /\ (dColour = 2 /\ dAlpha = 5) => quiet

\* An undo that lands puts back on the device exactly the edit the field held when the person made
\* the step: the file's value, a set value or inherit.
DeviceEditNext(field) == CASE field = 1 -> dColour' [] field = 2 -> dAlpha' [] OTHER -> dSize'
UndoPutsBack ==
  [][(turns' = turns + 1 /\ told' = 0) => DeviceEditNext(FieldOf(undo % 10)) = (undo % 100) \div 10]_vars

\* With no agent, two undos bring every field back to the file's own value: the export writes the
\* slide's own bytes, and once synced the server's rows fold to nothing.
BackToFile ==
  turns = 2 /\ agent = "none" =>
    /\ bytes
    /\ pending = 0 => sColour = 1 /\ sAlpha = 5 /\ sSize = 8

\* An export writes the slide's own bytes exactly while every field shows the file's own value.
BytesWhenUntouched == bytes <=> (dColour = 1 /\ dAlpha = 5 /\ dSize = 8)

\* An undo changes nothing only when the agent set the same field and the device read it. The
\* person's own rows, pending or not, never make an undo fail.
ToldOnlyOverAgent ==
  told # 0 => agent = (CASE told = 1 -> "colour" [] told = 2 -> "alpha" [] OTHER -> "none")

====

---- MODULE Typing ----
\* A person types into a slide's speaker notes, then over a text box, and presses Ctrl+Z
\* while what they typed is still on its way. Each edit is written to the device at once
\* (enqueue), and its undo record lands later: a keystroke's once the device answered and the
\* session's text before was read (editText in apps/web/src/editor/editable-slide.tsx), a notes edit's
\* once the notes edit before it reached the server (useNotes in apps/web/src/notes-edit.ts).
\* Each edit then goes to the server (flushPending), and the box stays busy until every
\* keystroke got there.
\* A text is a number: 0 is the text before the person's typing session, 1 its first letter,
\* 2 the whole new text. recorded in apps/web/src/undo-list.ts keeps one entry per run of
\* records of one session, holding the text that run reached. An entry is a digit: 1 and 2
\* are the notes at 1 and 2, 3 and 4 the box at 1 and 2. The undo list is the number whose
\* digits are its entries, the top one last; the redo list holds at most one entry.
EXTENDS Integers

VARIABLES nTyped, nRec, nUp, tTyped, tRec, tUp, list, redo, ask, deckT, deckN, shownT, shownN,
          done, turned, missing

vars == <<nTyped, nRec, nUp, tTyped, tRec, tUp, list, redo, ask, deckT, deckN, shownT, shownN,
          done, turned, missing>>

Entry(el, upto) == IF el = "N" THEN upto ELSE upto + 2
ElOf(entry) == IF entry <= 2 THEN "N" ELSE "T"
UptoOf(entry) == IF entry <= 2 THEN entry ELSE entry - 2

Top(l) == l % 10
Below(l) == l \div 10
Push(l, entry) == l * 10 + entry

TypeOK ==
  /\ nTyped \in 0..2 /\ nRec \in 0..nTyped /\ nUp \in 0..nRec
  /\ tTyped \in 0..2 /\ tRec \in 0..tTyped /\ tUp \in 0..tRec
  /\ list \in 0..4444
  /\ redo \in 0..4
  /\ ask \in {"none", "undo", "redo"}
  /\ deckT \in 0..2 /\ deckN \in 0..2 /\ shownT \in 0..2 /\ shownN \in 0..2
  /\ done \in {"none", "undone", "redone", "empty", "told"}
  /\ turned \in {"none", "N", "T"}
  /\ missing \in BOOLEAN

Init ==
  /\ nTyped = 0 /\ nRec = 0 /\ nUp = 0
  /\ tTyped = 0 /\ tRec = 0 /\ tUp = 0
  /\ list = 0 /\ redo = 0
  /\ ask = "none"
  /\ deckT = 0 /\ deckN = 0 /\ shownT = 0 /\ shownN = 0
  /\ done = "none" /\ turned = "none" /\ missing = FALSE

Notes == <<nTyped, nRec, nUp>>
Text == <<tTyped, tRec, tUp>>

\* A record joins the top entry when it is of the same session, and clears the redo list.
Recorded(el, upto) ==
  /\ list' = IF list > 0 /\ ElOf(Top(list)) = el
             THEN Push(Below(list), Entry(el, upto))
             ELSE Push(list, Entry(el, upto))
  /\ redo' = 0

\* The person types before asking for an undo, notes first, then over the text in the box.
Typing == ask = "none" /\ done = "none"

TypeNotes ==
  /\ Typing
  /\ tTyped = 0
  /\ nTyped < 2
  /\ nTyped' = nTyped + 1
  /\ deckN' = nTyped + 1
  /\ shownN' = nTyped + 1
  /\ UNCHANGED <<nRec, nUp, Text, list, redo, ask, deckT, shownT, done, turned, missing>>

TypeText ==
  /\ Typing
  /\ tTyped < 2
  /\ tTyped' = tTyped + 1
  /\ deckT' = tTyped + 1
  /\ shownT' = tTyped + 1
  /\ UNCHANGED <<Notes, tRec, tUp, list, redo, ask, deckN, shownN, done, turned, missing>>

\* A notes edit records only once the notes edit before it reached the server.
RecordNotes ==
  /\ nRec < nTyped
  /\ nUp = nRec
  /\ nRec' = nRec + 1
  /\ Recorded("N", nRec + 1)
  /\ UNCHANGED <<nTyped, nUp, Text, ask, deckT, deckN, shownT, shownN, done, turned, missing>>

\* Keystrokes record in typing order, and the box already shows them. The device answers in
\* typing order, and a notes edit whose queue is free records in the task its answer comes
\* in, so a keystroke records ahead of a notes edit typed before it only while that notes edit
\* waits for the one before it to reach the server.
RecordText ==
  /\ tRec < tTyped
  /\ nRec = nTyped \/ nUp < nRec
  /\ tRec' = tRec + 1
  /\ Recorded("T", tRec + 1)
  /\ UNCHANGED <<Notes, tTyped, tUp, ask, deckT, deckN, shownT, shownN, done, turned, missing>>

UploadNotes ==
  /\ nUp < nRec
  /\ nUp' = nUp + 1
  /\ UNCHANGED <<nTyped, nRec, Text, list, redo, ask, deckT, deckN, shownT, shownN, done, turned, missing>>

UploadText ==
  /\ tUp < tRec
  /\ tUp' = tUp + 1
  /\ UNCHANGED <<Notes, tTyped, tRec, list, redo, ask, deckT, deckN, shownT, shownN, done, turned, missing>>

\* Ctrl+Z outside a form field, in the box or on the slide, asks for the person's undo.
KeyUndo ==
  /\ Typing
  /\ nTyped + tTyped > 0
  /\ ask' = "undo"
  /\ UNCHANGED <<Notes, Text, list, redo, deckT, deckN, shownT, shownN, done, turned, missing>>

KeyRedo ==
  /\ ask = "none"
  /\ done = "undone"
  /\ ask' = "redo"
  /\ UNCHANGED <<Notes, Text, list, redo, deckT, deckN, shownT, shownN, done, turned, missing>>

\* Undo from the browser's own menu while the caret is in the box: the box refuses it.
MenuUndo ==
  /\ Typing
  /\ tTyped > 0
  /\ UNCHANGED vars

\* The undo waits for every keystroke's record and for the notes queue, then reads the list.
\* If the deck still shows the top entry's text it lands the other text, repaints as the
\* person and shows the notes; otherwise it drops the entry and tells the person.
Waited == tRec = tTyped /\ nUp = nTyped

Turn ==
  /\ ask # "none"
  /\ Waited
  /\ missing' = (missing \/ tRec < tTyped \/ nRec < nTyped)
  /\ ask' = "none"
  /\ LET from == IF ask = "undo" THEN list ELSE redo
         e == Top(from)
         el == ElOf(e)
         at == IF el = "T" THEN deckT ELSE deckN
         want == IF ask = "undo" THEN UptoOf(e) ELSE 0
         land == IF ask = "undo" THEN 0 ELSE UptoOf(e)
     IN IF from = 0
        THEN /\ done' = "empty"
             /\ UNCHANGED <<list, redo, deckT, deckN, shownT, shownN, turned>>
        ELSE IF at # want
        THEN /\ done' = "told"
             /\ list' = IF ask = "undo" THEN Below(list) ELSE list
             /\ redo' = IF ask = "undo" THEN redo ELSE Below(redo)
             /\ UNCHANGED <<deckT, deckN, shownT, shownN, turned>>
        ELSE /\ done' = IF ask = "undo" THEN "undone" ELSE "redone"
             /\ turned' = el
             /\ list' = IF ask = "undo" THEN Below(list) ELSE Push(list, e)
             /\ redo' = IF ask = "undo" THEN Push(redo, e) ELSE Below(redo)
             /\ deckT' = IF el = "T" THEN land ELSE deckT
             /\ deckN' = IF el = "N" THEN land ELSE deckN
             /\ shownT' = IF el = "T" THEN land ELSE shownT
             /\ shownN' = IF el = "N" THEN land ELSE shownN
  /\ UNCHANGED <<Notes, Text>>

Next ==
  TypeNotes \/ TypeText \/ RecordNotes \/ RecordText \/ UploadNotes \/ UploadText
    \/ KeyUndo \/ KeyRedo \/ MenuUndo \/ Turn

Spec == Init /\ [][Next]_vars

LastTyped == IF tTyped > 0 THEN "T" ELSE "N"
DeckOf(el) == IF el = "T" THEN deckT ELSE deckN
ShownOf(el) == IF el = "T" THEN shownT ELSE shownN
TypedOf(el) == IF el = "T" THEN tTyped ELSE nTyped

\* One undo after typing holds and shows, in the element it turned, the text from before the
\* typing session, never a part of the new text.
UndoRestoresBefore == done = "undone" => DeckOf(turned) = 0 /\ ShownOf(turned) = 0

\* That element is the one the person typed in last.
UndoTakesLastTyped == done = "undone" => turned = LastTyped

\* An undo or redo never reads a list that is missing a record already typed.
NoUndoOnMissing == ~missing

\* Every undo and redo the person asks for after typing lands.
TurnLands == done \notin {"empty", "told"}

\* What the person sees after an undo or redo is what the deck holds.
ShownIsDeck == done \in {"undone", "redone"} => shownT = deckT /\ shownN = deckN

\* A redo brings back the whole typed text.
RedoRestoresTyped == done = "redone" => DeckOf(turned) = TypedOf(turned) /\ ShownOf(turned) = DeckOf(turned)

\* Once the whole new text is typed, the box never shows only its first letter.
NeverPartOfNew == tTyped = 2 => shownT # 1

====

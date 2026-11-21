---- MODULE LeftOut ----
\* Edits the server accepted for one deck, while a page writes them into the deck's PowerPoint
\* file. Each edit either writes or the tab's writer throws on it, as text-run, text-paragraph
\* or text-body did before the server refused those inputs. count is how many edits there are,
\* and bad has bit i - 1 set when edit i does not write. The page writes through keptExport in
\* packages/pptx/src/kept-export.ts (writtenDeck in written-deck.ts does the same for slide
\* commands): it writes the edits it has not left out and, when that throws, finds the first
\* edit that does not write, leaves it out, and tries again. left has the bits of that page's
\* left-out edits (knownLeftOut), which a reload forgets. shown has the bits of the edits the
\* open page shows, and told says the page shows the notice "Unable to show some edits"
\* (noticeLeftOut in apps/web/src/editor/use-deck-paint.ts, and use-export.ts on an export).
EXTENDS Integers

VARIABLES count, bad, left, phase, shown, told, reloads

vars == <<count, bad, left, phase, shown, told, reloads>>

Edits == 3
Reloads == 1

Bit(mask, i) == (mask \div (2 ^ (i - 1))) % 2 = 1

All == 2 ^ count - 1

Writable == All - bad

TypeOK ==
  /\ count \in 0..Edits
  /\ bad \in 0..7
  /\ left \in 0..7
  /\ phase \in {"painting", "open"}
  /\ shown \in 0..7
  /\ told \in BOOLEAN
  /\ reloads \in 0..Reloads

\* The page opened an untouched deck.
Init ==
  /\ count = 0
  /\ bad = 0
  /\ left = 0
  /\ phase = "open"
  /\ shown = 0
  /\ told = FALSE
  /\ reloads = 0

\* The server accepts an edit; the page receives it and paints again.
Land(writes) ==
  /\ count < Edits
  /\ count' = count + 1
  /\ bad' = IF writes THEN bad ELSE bad + 2 ^ count
  /\ phase' = "painting"
  /\ UNCHANGED <<left, shown, told, reloads>>

Unwritten == {i \in 1..count : Bit(bad, i) /\ ~Bit(left, i)}

\* One try of keptExport: the edits not left out all write, so the page opens on them, or the
\* first edit that throws is left out.
Try ==
  /\ phase = "painting"
  /\ IF Unwritten = {}
     THEN /\ phase' = "open"
          /\ shown' = All - left
          /\ told' = (left # 0)
          /\ UNCHANGED <<count, bad, left, reloads>>
     ELSE /\ left' = left + 2 ^ ((CHOOSE i \in Unwritten : \A j \in Unwritten : i <= j) - 1)
          /\ UNCHANGED <<count, bad, phase, shown, told, reloads>>

\* The person reloads: the new page knows nothing it left out and paints every edit again.
Reload ==
  /\ reloads < Reloads
  /\ reloads' = reloads + 1
  /\ phase' = "painting"
  /\ left' = 0
  /\ shown' = 0
  /\ told' = FALSE
  /\ UNCHANGED <<count, bad>>

Next == (\E writes \in BOOLEAN : Land(writes)) \/ Try \/ Reload

Spec == Init /\ [][Next]_vars /\ WF_vars(Try)

\* An open page paints every edit the tab can write: the deck opens at its last good state.
ShowsEveryWritableEdit == phase = "open" => shown = Writable

\* The page leaves out only edits it cannot write.
LeavesOutOnlyUnwritable == \A i \in 1..Edits : Bit(left, i) => Bit(bad, i)

\* An open page tells the person exactly when it left an edit out.
ToldWhenLeftOut == phase = "open" => (told <=> bad # 0)

\* Every paint ends with the deck open, however many edits it cannot write.
OpensEventually == phase = "painting" ~> phase = "open"
====

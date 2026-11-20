---- MODULE DeviceQueue ----
\* A person sets one field of one element twice in the design panel, a line's width, then presses
\* Undo and Redo, while the server has not answered. A panel change paints at once from what the
\* canvas shows, ahead of the device (changeDesign in apps/web/src/design/design-change.ts,
\* paintingAhead in apps/web/src/editor/painted-ahead.ts). Each click queues one link on the
\* editor's chain (turnAfter in apps/web/src/editor/use-undo.ts), and the link does only the
\* device's work: it plans against the deck on the device, writes a pending row, records the undo
\* step and paints the device's deck (applyChange in apps/web/src/design/trait-edit.ts, turnBack
\* in apps/web/src/undo-list.ts). A link the device refuses paints the device's deck too. A click
\* and its link are one step here, so a state never holds a change painted ahead of its link. The send to the server starts after the link and settles on
\* its own (changeDesign in apps/web/src/design/design-change.ts, useUndoTurn). flush in
\* packages/live/src/cache.ts sends the pending rows one batch at a time, seals a batch with a once
\* before its first send, and confirms its rows when the answer comes. An agent may delete the
\* element on the server. The server then refuses the person's rows, and the device reads the
\* server's deck, sets the rows aside and paints again.
\* A width is a digit: 1 is the file's width, 2 the first width the person sets, 3 the second,
\* and 0 means the element is gone. Rows are numbered from 1 in the order the device wrote them.
\* wrote is the number whose digits are the widths the rows set, the first row first. The rows
\* after the first left are still on the device. onServer is the number whose digits are the rows
\* the server applied, in the order it applied them. An undo step is two digits, the width before
\* it and the width after it, and a list of steps is the number whose base-100 digits are its
\* steps, the top one last.
EXTENDS Integers

VARIABLES made, turns, wrote, left, sealed, spent, more, wire, losses, onServer, gone, mirror,
          aside, shown, repaint, undo, redo, told

vars == <<made, turns, wrote, left, sealed, spent, more, wire, losses, onServer, gone, mirror,
          aside, shown, repaint, undo, redo, told>>

Gone == 0
File == 1

Pow(n) == IF n = 0 THEN 1 ELSE IF n = 1 THEN 10 ELSE IF n = 2 THEN 100 ELSE IF n = 3 THEN 1000 ELSE 10000
Digits(n) == IF n = 0 THEN 0 ELSE IF n < 10 THEN 1 ELSE IF n < 100 THEN 2 ELSE IF n < 1000 THEN 3 ELSE 4

RECURSIVE Ids(_, _)
Ids(from, to) == IF from > to THEN 0 ELSE Ids(from, to - 1) * 10 + to

Written == Digits(wrote)
Row(id) == (wrote \div Pow(Written - id)) % 10
Pending == Written - left

\* The device's deck: the server's deck as the device last read it, with the pending rows played
\* over it. A row on an element the device read as gone is skipped.
Device == IF mirror = Gone THEN Gone ELSE IF Pending > 0 THEN wrote % 10 ELSE mirror

ServerShows == IF gone THEN Gone ELSE IF onServer = 0 THEN File ELSE Row(onServer % 10)

Top(list) == list % 100
Below(list) == list \div 100
Push(list, step) == list * 100 + step
Before(step) == step \div 10
After(step) == step % 10

TypeOK ==
  /\ made \in 0..2
  /\ turns \in 0..2
  /\ wrote \in 0..3333
  /\ left \in 0..Written
  /\ sealed \in 0..Pending
  /\ spent \in BOOLEAN
  /\ more \in 0..Pending
  /\ wire \in {"none", "sent", "applied", "refused"}
  /\ losses \in 0..1
  /\ onServer \in 0..1234
  /\ gone \in BOOLEAN
  /\ mirror \in 0..3
  /\ aside \in 0..4
  /\ shown \in 0..3
  /\ repaint \in BOOLEAN
  /\ undo \in 0..3333
  /\ redo \in 0..3333
  /\ told \in BOOLEAN

Init ==
  /\ made = 0
  /\ turns = 0
  /\ wrote = 0
  /\ left = 0
  /\ sealed = 0
  /\ spent = FALSE
  /\ more = 0
  /\ wire = "none"
  /\ losses = 0
  /\ onServer = 0
  /\ gone = FALSE
  /\ mirror = File
  /\ aside = 0
  /\ shown = File
  /\ repaint = FALSE
  /\ undo = 0
  /\ redo = 0
  /\ told = FALSE

Network == <<left, sealed, spent, more, wire, losses, onServer, gone, mirror, aside, repaint>>

\* A link writes one pending row and paints what the device now holds.
Wrote(width) ==
  /\ wrote' = wrote * 10 + width
  /\ shown' = width
  /\ told' = FALSE

\* A panel change plans against the device's deck. On an element the device reads as gone it is
\* refused, writes nothing, and the canvas paints the device's deck in place of the width it
\* painted ahead; otherwise it records the step from what the device showed.
Change(width) ==
  IF Device = Gone
  THEN /\ shown' = Device
       /\ UNCHANGED <<wrote, told, undo, redo>>
  ELSE /\ Wrote(width)
       /\ undo' = Push(undo, Device * 10 + width)
       /\ redo' = 0

\* Undo lands the width before the top step while the device still shows the width after it, and
\* Redo the width after it while the device shows the width before. Otherwise nothing changes,
\* the step leaves its list, and the person is told.
Turn(back) ==
  LET from == IF back THEN undo ELSE redo
      step == Top(from)
      want == IF back THEN After(step) ELSE Before(step)
      land == IF back THEN Before(step) ELSE After(step)
  IN IF Device = want
     THEN /\ Wrote(land)
          /\ undo' = IF back THEN Below(undo) ELSE Push(undo, step)
          /\ redo' = IF back THEN Push(redo, step) ELSE Below(redo)
     ELSE /\ told' = TRUE
          /\ undo' = IF back THEN Below(undo) ELSE undo
          /\ redo' = IF back THEN redo ELSE Below(redo)
          /\ UNCHANGED <<wrote, shown>>

\* The person clicks the first width, then the second, then Undo, then Redo, each while its
\* control is on. None of them waits for the server.
ClickFirst ==
  /\ made = 0
  /\ made' = 1
  /\ Change(2)
  /\ UNCHANGED <<turns, Network>>

ClickSecond ==
  /\ made = 1
  /\ made' = 2
  /\ Change(3)
  /\ UNCHANGED <<turns, Network>>

ClickUndo ==
  /\ made = 2
  /\ turns = 0
  /\ undo # 0
  /\ turns' = 1
  /\ Turn(TRUE)
  /\ UNCHANGED <<made, Network>>

ClickRedo ==
  /\ turns = 1
  /\ redo # 0
  /\ turns' = 2
  /\ Turn(FALSE)
  /\ UNCHANGED <<made, Network>>

Person == <<made, turns, wrote, shown, undo, redo, told>>

\* Each click asks for a send, and a lost answer schedules one, so a send goes whenever rows wait
\* and no request is on its way. A batch a lost send sealed goes again with its once, and the rows
\* after it follow in the same send; otherwise every pending row is sealed with a new once.
Send ==
  /\ wire = "none"
  /\ Pending > 0
  /\ wire' = "sent"
  /\ sealed' = IF sealed = 0 THEN Pending ELSE sealed
  /\ more' = IF sealed = 0 THEN 0 ELSE Pending - sealed
  /\ UNCHANGED <<Person, left, spent, losses, onServer, gone, mirror, aside, repaint>>

\* The server applies the batch, or answers a once it already spent and writes nothing.
Apply ==
  /\ wire = "sent"
  /\ spent \/ ~gone
  /\ wire' = "applied"
  /\ spent' = TRUE
  /\ onServer' = IF spent THEN onServer ELSE onServer * Pow(sealed) + Ids(left + 1, left + sealed)
  /\ UNCHANGED <<Person, left, sealed, more, losses, gone, mirror, aside, repaint>>

\* The element is gone on the server, so it refuses a batch it has not applied.
Refuse ==
  /\ wire = "sent"
  /\ ~spent
  /\ gone
  /\ wire' = "refused"
  /\ UNCHANGED <<Person, left, sealed, spent, more, losses, onServer, gone, mirror, aside, repaint>>

\* The device reads the answer: the batch's rows become the server's deck as the device read it,
\* and the next batch of the same send goes at once.
Answer ==
  /\ wire = "applied"
  /\ left' = left + sealed
  /\ mirror' = Row(left + sealed)
  /\ spent' = FALSE
  /\ wire' = IF more > 0 THEN "sent" ELSE "none"
  /\ sealed' = more
  /\ more' = 0
  /\ UNCHANGED <<Person, losses, onServer, gone, aside, repaint>>

\* The answer is lost. The rows stay pending and sealed with their once, and a send is due again.
Lose ==
  /\ wire = "applied"
  /\ losses < 1
  /\ losses' = losses + 1
  /\ wire' = "none"
  /\ more' = 0
  /\ UNCHANGED <<Person, left, sealed, spent, onServer, gone, mirror, aside, repaint>>

\* The device reads a refusal: it reads the server's deck, where the element is gone, and sets
\* aside every pending row, since none can land on it. The editor then paints again.
SetAside ==
  /\ wire = "refused"
  /\ wire' = "none"
  /\ mirror' = Gone
  /\ aside' = aside + Pending
  /\ left' = Written
  /\ sealed' = 0
  /\ spent' = FALSE
  /\ more' = 0
  /\ repaint' = TRUE
  /\ UNCHANGED <<Person, losses, onServer, gone>>

Reconcile ==
  /\ repaint
  /\ repaint' = FALSE
  /\ shown' = Device
  /\ UNCHANGED <<made, turns, wrote, undo, redo, told, left, sealed, spent, more, wire, losses, onServer, gone, mirror, aside>>

AgentDelete ==
  /\ ~gone
  /\ gone' = TRUE
  /\ UNCHANGED <<Person, left, sealed, spent, more, wire, losses, onServer, mirror, aside, repaint>>

Clicks == ClickFirst \/ ClickSecond \/ ClickUndo \/ ClickRedo

Next == Clicks \/ Send \/ Apply \/ Refuse \/ Answer \/ Lose \/ SetAside \/ Reconcile \/ AgentDelete

\* The person keeps clicking. Nothing says the server ever answers.
Spec == Init /\ [][Next]_vars /\ WF_vars(Clicks)

\* Whatever the server does, never answering included, the person clicks through both widths,
\* Undo and Redo, and each click paints. Redo has nothing to redo after an Undo that changed nothing.
ClickedThrough == made = 2 /\ (turns = 2 \/ (turns = 1 /\ redo = 0))
PaintsBeforeAnswers == <>ClickedThrough

\* The canvas shows the device's deck, but for the moment between a set-aside and its repaint.
ShownIsDevice == repaint \/ shown = Device

\* Once every answer came, the device shows the server's deck. The one exception is an agent's
\* delete the device has not read yet; it reads it when it next follows the deck.
Settled == Pending = 0 /\ wire = "none" /\ ~repaint
SettledShowsServer == Settled => shown = ServerShows \/ (gone /\ mirror # Gone)

\* The server applies the person's rows in the order the device wrote them, each once.
LandsInOrderOnce == onServer \in {0, 1, 12, 123, 1234}

\* A row leaves the device only once the server applied it, or refused it because it is gone.
NoEditLost == left - aside <= Digits(onServer) /\ (aside > 0 => gone)

\* While the element is there, the top undo step is the one that brought the device to what it
\* shows, and the top redo step starts there. So Undo turns the person's last step.
UndoTakesLastStep ==
  mirror # Gone =>
    /\ (undo # 0 => After(Top(undo)) = Device)
    /\ (redo # 0 => Before(Top(redo)) = Device)

\* Undo or Redo changes nothing only when the device reads the element as gone: the person's own
\* rows, answered or not, never make a turn fail. So a Redo straight after an Undo lands.
ToldOnlyWhenGone == told => Device = Gone

\* Once the device read that the element is gone, it writes no row for it, so no Undo or Redo
\* brings back what the agent deleted.
NothingAfterGone == mirror = Gone => Pending = 0

====

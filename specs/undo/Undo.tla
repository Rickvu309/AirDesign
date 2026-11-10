---- MODULE Undo ----
\* Undo of a run hides only that run's rows. A later run's rows and every person row stay.
EXTENDS Integers

VARIABLES
  person,
  prevPerson,
  agent,
  hidden,
  eligible,
  undoMark,
  dropped,
  track,
  later,
  laterHidden,
  laterLanded,
  hiddenBy,
  firstLive

vars == <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, track, later, laterHidden, laterLanded, hiddenBy, firstLive>>

\* Records which undo took the later row out of view, in the step that does it.
Hider(name) == hiddenBy' = IF later = 1 /\ later' = 0 THEN name ELSE hiddenBy

TypeOK ==
  /\ person \in {0, 1}
  /\ prevPerson \in {0, 1}
  /\ agent \in {0, 1}
  /\ hidden \in {0, 1}
  /\ eligible \in BOOLEAN
  /\ undoMark \in BOOLEAN
  /\ dropped \in BOOLEAN
  /\ track \in {"old", "held", "second", "secondStopped", "firstGone", "bothGone"}
  /\ later \in {0, 1}
  /\ laterHidden \in {0, 1}
  /\ laterLanded \in BOOLEAN
  /\ hiddenBy \in {"none", "firstUndo", "secondUndo", "laterUndo"}
  /\ firstLive \in BOOLEAN

Init ==
  /\ person = 0
  /\ prevPerson = 0
  /\ agent = 0
  /\ hidden = 0
  /\ eligible = FALSE
  /\ undoMark = FALSE
  /\ dropped = FALSE
  /\ track = "old"
  /\ later = 0
  /\ laterHidden = 0
  /\ laterLanded = FALSE
  /\ hiddenBy = "none"
  /\ firstLive = FALSE

PersonWrites ==
  /\ track = "old"
  /\ person = 0
  /\ person' = 1
  /\ prevPerson' = 1
  /\ UNCHANGED <<agent, hidden, eligible, undoMark, dropped, track, later, laterHidden, laterLanded, hiddenBy, firstLive>>

AgentWrites ==
  /\ track = "old"
  /\ undoMark = FALSE
  /\ dropped = FALSE
  /\ agent = 0
  /\ hidden = 0
  /\ agent' = 1
  /\ UNCHANGED <<person, prevPerson, hidden, eligible, undoMark, dropped, track, later, laterHidden, laterLanded, hiddenBy, firstLive>>

GiveHorizon ==
  /\ track = "old"
  /\ dropped = FALSE
  /\ eligible = FALSE
  /\ eligible' = TRUE
  /\ UNCHANGED <<person, prevPerson, agent, hidden, undoMark, dropped, track, later, laterHidden, laterLanded, hiddenBy, firstLive>>

Undo ==
  /\ track = "old"
  /\ undoMark = FALSE
  /\ dropped = FALSE
  /\ undoMark' = TRUE
  /\ person' = person
  /\ agent' = 0
  /\ hidden' = agent
  /\ UNCHANGED <<prevPerson, eligible, dropped, track, later, laterHidden, laterLanded, hiddenBy, firstLive>>

Compact ==
  /\ track = "old"
  /\ eligible = TRUE
  /\ hidden = 1
  /\ dropped' = TRUE
  /\ person' = person
  /\ hidden' = 0
  /\ undoMark' = FALSE
  /\ UNCHANGED <<prevPerson, eligible, agent, track, later, laterHidden, laterLanded, hiddenBy, firstLive>>

Done ==
  /\ track = "old"
  /\ person = 1
  /\ (dropped = TRUE \/ (undoMark = TRUE /\ hidden = 0 /\ eligible = TRUE))
  /\ UNCHANGED vars

\* The first run stops with its row still visible.
StopFirst ==
  /\ track = "old"
  /\ person = 1
  /\ prevPerson = 1
  /\ agent = 1
  /\ hidden = 0
  /\ eligible = FALSE
  /\ undoMark = FALSE
  /\ dropped = FALSE
  /\ track' = "held"
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, later, laterHidden, laterLanded, hiddenBy, firstLive>>

\* A new run starts on the same element.
StartSecond ==
  /\ track = "held"
  /\ track' = "second"
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, later, laterHidden, laterLanded, hiddenBy, firstLive>>

\* The later run lands its own row. The earlier row stays.
LaterWrites ==
  /\ track = "second"
  /\ later = 0
  /\ later' = 1
  /\ laterLanded' = TRUE
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, track, laterHidden, hiddenBy, firstLive>>

\* Undo of the earlier run stays fenced while the later run is live.
UndoFirstLive ==
  /\ track = "second"
  /\ agent = 1
  /\ UNCHANGED vars

\* The later run stops. Both rows stay visible.
StopSecond ==
  /\ track = "second"
  /\ later = 1
  /\ track' = "secondStopped"
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, later, laterHidden, laterLanded, hiddenBy, firstLive>>

\* Undo of the earlier run hides only that run's row and leaves the later run stopped.
UndoFirst ==
  /\ track = "secondStopped"
  /\ agent = 1
  /\ agent' = 0
  /\ hidden' = 1
  /\ track' = "firstGone"
  /\ later' = later
  /\ laterHidden' = laterHidden
  /\ Hider("firstUndo")
  /\ firstLive' = (firstLive \/ track = "second")
  /\ UNCHANGED <<person, prevPerson, eligible, undoMark, dropped, laterLanded>>

\* Undo of the later run hides only that run's row.
UndoSecond ==
  /\ track = "firstGone"
  /\ later = 1
  /\ later' = 0
  /\ laterHidden' = 1
  /\ track' = "bothGone"
  /\ Hider("laterUndo")
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, laterLanded, firstLive>>

\* A second undo of the earlier run removes nothing more.
UndoFirstAgain ==
  /\ track \in {"firstGone", "bothGone"}
  /\ hidden = 1
  /\ later' = later
  /\ laterHidden' = laterHidden
  /\ Hider("secondUndo")
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, track, laterLanded, firstLive>>

\* A second undo of the later run removes nothing more.
UndoLaterAgain ==
  /\ track = "bothGone"
  /\ laterHidden = 1
  /\ UNCHANGED vars

Next ==
  PersonWrites \/ AgentWrites \/ GiveHorizon \/ Undo \/ Compact \/ Done \/ StopFirst \/ StartSecond \/ LaterWrites \/ UndoFirstLive \/ StopSecond \/ UndoFirst \/ UndoSecond \/ UndoFirstAgain \/ UndoLaterAgain

Spec == Init /\ [][Next]_vars

\* Undo keeps the person row that was there.
UndoKeepsPerson == undoMark = FALSE \/ person = prevPerson

\* Compaction keeps the person row that was there.
CompactKeepsHead == dropped = FALSE \/ person = prevPerson

\* A hidden row is dropped only after a horizon was given.
HorizonIsGiven == dropped = FALSE \/ eligible = TRUE

\* Undo of an earlier run does not clear the later run's row. A later row out of view was taken out by the later run's own undo.
EarlierUndoKeepsLater ==
  /\ hiddenBy # "firstUndo"
  /\ hiddenBy = "none" => later = 1 \/ laterLanded = FALSE
  /\ hiddenBy = "laterUndo" => track = "bothGone"

\* While the later run is live, the earlier row stays visible, and no undo of the earlier run applies.
LiveRunKeepsEarlier ==
  /\ track # "second" \/ agent = 1
  /\ firstLive = FALSE

\* A second undo removes nothing more. It never hides the later row, and no row is both visible and hidden.
SecondUndoRemovesNothing ==
  /\ hiddenBy # "secondUndo"
  /\ laterHidden = 0 \/ later = 0

\* A person row stays where undo found it.
PersonRowsStay ==
  person = prevPerson

====

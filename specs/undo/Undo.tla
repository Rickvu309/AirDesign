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
  laterLanded

vars == <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, track, later, laterHidden, laterLanded>>

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

PersonWrites ==
  /\ track = "old"
  /\ person = 0
  /\ person' = 1
  /\ prevPerson' = 1
  /\ UNCHANGED <<agent, hidden, eligible, undoMark, dropped, track, later, laterHidden, laterLanded>>

AgentWrites ==
  /\ track = "old"
  /\ undoMark = FALSE
  /\ dropped = FALSE
  /\ agent = 0
  /\ hidden = 0
  /\ agent' = 1
  /\ UNCHANGED <<person, prevPerson, hidden, eligible, undoMark, dropped, track, later, laterHidden, laterLanded>>

GiveHorizon ==
  /\ track = "old"
  /\ dropped = FALSE
  /\ eligible = FALSE
  /\ eligible' = TRUE
  /\ UNCHANGED <<person, prevPerson, agent, hidden, undoMark, dropped, track, later, laterHidden, laterLanded>>

Undo ==
  /\ track = "old"
  /\ undoMark = FALSE
  /\ dropped = FALSE
  /\ undoMark' = TRUE
  /\ person' = person
  /\ agent' = 0
  /\ hidden' = agent
  /\ UNCHANGED <<prevPerson, eligible, dropped, track, later, laterHidden, laterLanded>>

Compact ==
  /\ track = "old"
  /\ eligible = TRUE
  /\ hidden = 1
  /\ dropped' = TRUE
  /\ person' = person
  /\ hidden' = 0
  /\ undoMark' = FALSE
  /\ UNCHANGED <<prevPerson, eligible, agent, track, later, laterHidden, laterLanded>>

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
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, later, laterHidden, laterLanded>>

\* A new run starts on the same element.
StartSecond ==
  /\ track = "held"
  /\ track' = "second"
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, later, laterHidden, laterLanded>>

\* The later run lands its own row. The earlier row stays.
LaterWrites ==
  /\ track = "second"
  /\ later = 0
  /\ later' = 1
  /\ laterLanded' = TRUE
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, track, laterHidden>>

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
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, later, laterHidden, laterLanded>>

\* Undo of the earlier run hides only that run's row and leaves the later run stopped.
UndoFirst ==
  /\ track = "secondStopped"
  /\ agent = 1
  /\ agent' = 0
  /\ hidden' = 1
  /\ track' = "firstGone"
  /\ UNCHANGED <<person, prevPerson, eligible, undoMark, dropped, later, laterHidden, laterLanded>>

\* Undo of the later run hides only that run's row.
UndoSecond ==
  /\ track = "firstGone"
  /\ later = 1
  /\ later' = 0
  /\ laterHidden' = 1
  /\ track' = "bothGone"
  /\ UNCHANGED <<person, prevPerson, agent, hidden, eligible, undoMark, dropped, laterLanded>>

\* A second undo of the earlier run removes nothing more.
UndoFirstAgain ==
  /\ track \in {"firstGone", "bothGone"}
  /\ hidden = 1
  /\ UNCHANGED vars

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

\* Undo of an earlier run does not clear the later run's row.
EarlierUndoKeepsLater ==
  laterLanded = FALSE \/ later = 1 \/ laterHidden = 1

\* While the later run is live, the earlier row stays visible.
LiveRunKeepsEarlier ==
  track # "second" \/ agent = 1

\* A second undo removes nothing more.
SecondUndoRemovesNothing ==
  laterHidden = 0 \/ later = 0

\* A person row stays where undo found it.
PersonRowsStay ==
  person = prevPerson

====

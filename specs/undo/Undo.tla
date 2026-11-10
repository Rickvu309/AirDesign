---- MODULE Undo ----
EXTENDS Integers

VARIABLES
  person,
  prevPerson,
  agent,
  hidden,
  eligible,
  undoMark,
  dropped

vars == <<person, prevPerson, agent, hidden, eligible, undoMark, dropped>>

TypeOK ==
  /\ person \in {0, 1}
  /\ prevPerson \in {0, 1}
  /\ agent \in {0, 1}
  /\ hidden \in {0, 1}
  /\ eligible \in BOOLEAN
  /\ undoMark \in BOOLEAN
  /\ dropped \in BOOLEAN

Init ==
  /\ person = 0
  /\ prevPerson = 0
  /\ agent = 0
  /\ hidden = 0
  /\ eligible = FALSE
  /\ undoMark = FALSE
  /\ dropped = FALSE

PersonWrites ==
  /\ person = 0
  /\ person' = 1
  /\ prevPerson' = 1
  /\ UNCHANGED <<agent, hidden, eligible, undoMark, dropped>>

AgentWrites ==
  /\ undoMark = FALSE
  /\ dropped = FALSE
  /\ agent = 0
  /\ hidden = 0
  /\ agent' = 1
  /\ UNCHANGED <<person, prevPerson, hidden, eligible, undoMark, dropped>>

GiveHorizon ==
  /\ dropped = FALSE
  /\ eligible = FALSE
  /\ eligible' = TRUE
  /\ UNCHANGED <<person, prevPerson, agent, hidden, undoMark, dropped>>

Undo ==
  /\ undoMark = FALSE
  /\ dropped = FALSE
  /\ undoMark' = TRUE
  /\ person' = person
  /\ agent' = 0
  /\ hidden' = agent
  /\ UNCHANGED <<prevPerson, eligible, dropped>>

Compact ==
  /\ eligible = TRUE
  /\ hidden = 1
  /\ dropped' = TRUE
  /\ person' = person
  /\ hidden' = 0
  /\ undoMark' = FALSE
  /\ UNCHANGED <<prevPerson, eligible, agent>>

Done ==
  /\ person = 1
  /\ (dropped = TRUE \/ (undoMark = TRUE /\ hidden = 0 /\ eligible = TRUE))
  /\ UNCHANGED vars

Next == PersonWrites \/ AgentWrites \/ GiveHorizon \/ Undo \/ Compact \/ Done

Spec == Init /\ [][Next]_vars

UndoKeepsPerson == undoMark = FALSE \/ person = prevPerson

CompactKeepsHead == dropped = FALSE \/ person = prevPerson

HorizonIsGiven == dropped = FALSE \/ eligible = TRUE

====

---- MODULE SlideUndo ----
\* A person's run Undo of agent run r after r added a slide, with the agent still calling.
\* Each agent call and each person write is one step here: the requests run one after
\* another. The race between them is in the slide-run model.
\* turn is session.agent_turn. Undo goes through undoRun in apps/api/src/undo.ts and never
\* touches the turn row, so the turn names r after an Undo whenever the agent did not stop r.
EXTENDS Integers

VARIABLES rev, shown, moved, turn, adds, undos, undone, afterUndo, told

vars == <<rev, shown, moved, turn, adds, undos, undone, afterUndo, told>>

TypeOK ==
  /\ rev \in 1..6
  /\ shown \in 0..3
  /\ moved \in BOOLEAN
  /\ turn \in {"r", "u", "none"}
  /\ adds \in 0..2
  /\ undos \in 0..2
  /\ undone \in BOOLEAN
  /\ afterUndo \in 0..2
  /\ told \in {"none", "applied", "refused"}

Init ==
  /\ rev = 1
  /\ shown = 1
  /\ moved = FALSE
  /\ turn = "r"
  /\ adds = 0
  /\ undos = 0
  /\ undone = FALSE
  /\ afterUndo = 0
  /\ told = "none"

\* read_deck, then add_slide on that base. The slide lands under the turn's run, or under
\* a fresh run when no turn is live, and settleTurn saves that run in the turn row.
AgentAddsSlide ==
  /\ adds < 2
  /\ adds' = adds + 1
  /\ rev' = rev + 1
  /\ shown' = IF turn = "r" THEN shown + 1 ELSE shown
  /\ afterUndo' = IF turn = "r" /\ undone THEN afterUndo + 1 ELSE afterUndo
  /\ turn' = IF turn = "none" THEN "u" ELSE turn
  /\ UNCHANGED <<moved, undos, undone, told>>

\* stop_run of r ends the turn. A run that only added slides does not change the deck.
AgentStops ==
  /\ turn = "r"
  /\ turn' = "none"
  /\ UNCHANGED <<rev, shown, moved, adds, undos, undone, afterUndo, told>>

\* A person moves a slide r added to the start of the deck.
PersonMoves ==
  /\ shown > 0
  /\ ~moved
  /\ moved' = TRUE
  /\ rev' = rev + 1
  /\ UNCHANGED <<shown, turn, adds, undos, undone, afterUndo, told>>

\* undoSlides walks every slide row of r from the newest and takes each back only while
\* the slide still sits where that row left it. One that does not refuses the whole Undo.
\* A slide r added that a person moved, or that an earlier Undo took back, does not.
UndoApplies == ~moved /\ ~undone

PersonUndoes ==
  /\ undos < 2
  /\ undos' = undos + 1
  /\ IF UndoApplies
     THEN /\ rev' = rev + 1
          /\ shown' = 0
          /\ undone' = TRUE
          /\ told' = "applied"
     ELSE /\ told' = "refused"
          /\ UNCHANGED <<rev, shown, undone>>
  /\ UNCHANGED <<moved, turn, adds, afterUndo>>

Done ==
  /\ adds = 2
  /\ undos = 2
  /\ UNCHANGED vars

Next == AgentAddsSlide \/ AgentStops \/ PersonMoves \/ PersonUndoes \/ Done

Spec == Init /\ [][Next]_vars

\* An Undo takes back every slide of r that shows, or none of them.
UndoAllOrNothing == undone => shown = afterUndo

\* An Undo refused leaves the deck as it was.
RefusedChangesNothing == [][undos' > undos /\ told' = "refused" => rev' = rev /\ shown' = shown]_vars

\* No slide of r lands once its Undo landed. afterUndo counts the ones that did.
UndoFences == afterUndo = 0

\* A slide of r that shows and that no person moved can be taken back by run Undo.
UndoReachesEverySlide == shown > 0 /\ ~moved => UndoApplies
====

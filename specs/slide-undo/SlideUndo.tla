---- MODULE SlideUndo ----
\* A person's run Undo of agent run r after r added a slide or deleted slide D, with the
\* agent still calling, and a person who may delete D again once an Undo brought it back.
\* Each agent call and each person write is one step here: the requests run one after
\* another. The race between them is in the slide-run model.
\* turn is session.agent_turn. Undo goes through undoRun in apps/api/src/undo.ts and never
\* touches the turn row, so the turn names r after an Undo whenever the agent did not stop r.
\* ended is the deck's record that r ended: stop_run and run Undo of a run with slide rows
\* write it, agentSlide refuses the run, and liveTurn does not take it as the turn's run.
\* dropped says r's first command deleted D, and dShows whether D shows. added says r added
\* a slide. fenced says a row of anyone but r removed or restored a slide r added or
\* deleted, after r's row: the rows a run Undo writes carry no run, so its own Undo does.
EXTENDS Integers

VARIABLES rev, shown, moved, turn, ended, adds, undos, undone, afterUndo, told, dropped, dShows, added, fenced

vars == <<rev, shown, moved, turn, ended, adds, undos, undone, afterUndo, told, dropped, dShows, added, fenced>>

TypeOK ==
  /\ rev \in 1..9
  /\ shown \in 0..3
  /\ moved \in BOOLEAN
  /\ turn \in {"r", "u", "none"}
  /\ ended \in BOOLEAN
  /\ adds \in 0..2
  /\ undos \in 0..2
  /\ undone \in BOOLEAN
  /\ afterUndo \in 0..2
  /\ told \in {"none", "applied", "refused"}
  /\ dropped \in BOOLEAN
  /\ dShows \in BOOLEAN
  /\ added \in BOOLEAN
  /\ fenced \in BOOLEAN

Init ==
  /\ dropped \in BOOLEAN
  /\ rev = 1
  /\ shown = IF dropped THEN 0 ELSE 1
  /\ moved = FALSE
  /\ turn = "r"
  /\ ended = FALSE
  /\ adds = 0
  /\ undos = 0
  /\ undone = FALSE
  /\ afterUndo = 0
  /\ told = "none"
  /\ dShows = ~dropped
  /\ added = ~dropped
  /\ fenced = FALSE

\* read_deck, then add_slide on that base. The slide lands under the turn's run, or under
\* a fresh run when no turn is live, and settleTurn saves that run in the turn row.
\* A turn that names r is not live once the deck records r ended.
SlideRunOf == IF turn = "none" \/ (turn = "r" /\ ended) THEN "u" ELSE turn

AgentAddsSlide ==
  /\ adds < 2
  /\ adds' = adds + 1
  /\ rev' = rev + 1
  /\ shown' = IF SlideRunOf = "r" THEN shown + 1 ELSE shown
  /\ afterUndo' = IF SlideRunOf = "r" /\ undone THEN afterUndo + 1 ELSE afterUndo
  /\ turn' = SlideRunOf
  /\ added' = (added \/ SlideRunOf = "r")
  /\ UNCHANGED <<moved, ended, undos, undone, told, dropped, dShows, fenced>>

\* stop_run of r ends the turn and records r ended, which changes the deck unless an
\* earlier Undo already recorded it.
AgentStops ==
  /\ turn = "r"
  /\ turn' = "none"
  /\ rev' = IF ended THEN rev ELSE rev + 1
  /\ ended' = TRUE
  /\ UNCHANGED <<shown, moved, adds, undos, undone, afterUndo, told, dropped, dShows, added, fenced>>

\* A person moves a slide r added to the start of the deck.
PersonMoves ==
  /\ shown > 0
  /\ ~moved
  /\ moved' = TRUE
  /\ rev' = rev + 1
  /\ UNCHANGED <<shown, turn, ended, adds, undos, undone, afterUndo, told, dropped, dShows, added, fenced>>

\* A person deletes D again after a run Undo brought it back.
PersonDeletes ==
  /\ dropped
  /\ dShows
  /\ dShows' = FALSE
  /\ fenced' = TRUE
  /\ rev' = rev + 1
  /\ UNCHANGED <<shown, moved, turn, ended, adds, undos, undone, afterUndo, told, dropped, added>>

\* undoSlides walks every slide row of r from the newest and takes each back only while
\* the slide still sits where that row left it. One that does not refuses the whole Undo.
\* A slide r added that a person moved, or that an earlier Undo took back, does not, and
\* D sits where r left it while it is gone. fencedSince in undoableAt refuses a row whose
\* slide anyone but r removed or restored since.
UndoApplies == ~fenced /\ (~added \/ (~moved /\ ~undone)) /\ (dropped => ~dShows)

PersonUndoes ==
  /\ undos < 2
  /\ undos' = undos + 1
  /\ IF UndoApplies
     THEN /\ rev' = rev + 1
          /\ shown' = 0
          /\ dShows' = (dShows \/ dropped)
          /\ undone' = TRUE
          /\ ended' = TRUE
          /\ fenced' = TRUE
          /\ told' = "applied"
     ELSE /\ told' = "refused"
          /\ UNCHANGED <<rev, shown, dShows, undone, ended, fenced>>
  /\ UNCHANGED <<moved, turn, adds, afterUndo, dropped, added>>

Done ==
  /\ adds = 2
  /\ undos = 2
  /\ UNCHANGED vars

Next == AgentAddsSlide \/ AgentStops \/ PersonMoves \/ PersonDeletes \/ PersonUndoes \/ Done

Spec == Init /\ [][Next]_vars

\* An Undo takes back every slide of r that shows, or none of them.
UndoAllOrNothing == undone => shown = afterUndo

\* An Undo refused leaves the deck as it was.
RefusedChangesNothing ==
  [][undos' > undos /\ told' = "refused" => rev' = rev /\ shown' = shown /\ dShows' = dShows]_vars

\* No slide of r lands once its Undo landed. afterUndo counts the ones that did.
UndoFences == afterUndo = 0

\* A slide of r that shows and that no person moved can be taken back by run Undo.
UndoReachesEverySlide == shown > 0 /\ ~moved => UndoApplies

\* A run's Undo lands at most once: after one landed, a later Undo of the run is refused,
\* even once a person put back what it took back.
RunUndoOnce == [][undone /\ undos' > undos => told' = "refused"]_vars
====

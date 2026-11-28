---- MODULE UndoPendingMoves ----
\* A move the person's tab sends before it has seen another tab delete the layer and its frame, and the undos of
\* both tabs around it. The slide holds frame P, and P holds the card K.
\* pK is K's parent: 1 for P, or -1 while K is deleted. pP is P's parent: 0 for the slide, or -1 while P is deleted.
\* Edits are numbered from 1 in the order they land; wK and wP name the edit that wrote each parent last, turned is
\* the set of undos that landed and undid the set of those the other tab made, each as bits.
\* The person may, once, reorder K in P while K shows, from a tab that is offline or has not caught up: the move is
\* pending until it replays (`queueEditOn` in packages/live/src/doom-queue.ts). It is an ordinary edit, so it
\* has no base. A separate path starts with an undo of a landed move of K within P, queued while offline.
\* Its replay follows the other tab's delete of K, with an optional delete of P before it lands. Online, the person may delete K once while it shows, and press Ctrl+Z once on that step.
\* Another tab may delete K while it shows, or P while it stands, twice in all, and press Ctrl+Z on its own steps.
\* parentLanding decides a parent write on deleted K. A matching base restores it, even into deleted P.
\* An older base drops the write even into deleted P. An absent base drops it into standing P and
\* refuses it into deleted P. onTop preserves the older or absent base for optimistic projection.
\* An undo writes a parent only when its step or an undo of the same tab wrote it last, and with
\* nothing to write takes the step off and does nothing.
EXTENDS Integers

VARIABLES pK, pP, wK, wP, n, turned, undid, pending, cut, stacked, theirs, t1, t2, acts, hid

vars == <<pK, pP, wK, wP, n, turned, undid, pending, cut, stacked, theirs, t1, t2, acts, hid>>

Shows == pK = 1 /\ pP = 0
In(bits, id) == (bits \div (2 ^ id)) % 2 = 1
Base(edit) == IF edit = wK THEN "matching" ELSE "older"

ParentLanding(base) ==
  IF pK = -1
  THEN IF base = "matching" THEN "restore"
       ELSE IF base = "older" \/ pP = 0 THEN "drop" ELSE "refuse"
  ELSE IF pP = 0 THEN "move" ELSE "refuse"

Lands(base) == ParentLanding(base) \in {"move", "restore"}
InverseQueued == pending = "inverse"
Waiting == pending \in {"queued", "inverse"}

TypeOK ==
  /\ pK \in {-1, 1} /\ pP \in {-1, 0} /\ {wK, wP} \subseteq 0..7 /\ n \in 0..7 /\ {turned, undid} \subseteq 0..255
  /\ pending \in {"none", "queued", "inverse", "landed", "refused"} /\ cut \in 0..7 /\ stacked \in BOOLEAN
  /\ theirs \in 0..2 /\ {t1, t2} \subseteq 0..72 /\ acts \in 0..2 /\ hid \in BOOLEAN

Init ==
  /\ pK = 1 /\ pP = 0 /\ wK = 0 /\ wP = 0 /\ n = 0 /\ turned = 0 /\ undid = 0
  /\ pending = "none" /\ cut = 0 /\ stacked = FALSE /\ theirs = 0 /\ t1 = 0 /\ t2 = 0 /\ acts = 0 /\ hid = FALSE

Theirs == UNCHANGED <<undid, theirs, t1, t2, acts, hid>>

PersonMove ==
  /\ pending = "none" /\ Shows /\ pending' = "queued"
  /\ UNCHANGED <<pK, pP, wK, wP, n, turned, cut, stacked>> /\ Theirs

QueueMoveInverse ==
  /\ n = 0 /\ pending = "none" /\ pending' = "inverse"
  /\ UNCHANGED <<pK, pP, wK, wP, n, turned, cut, stacked>> /\ Theirs

Replay ==
  /\ Waiting /\ (InverseQueued => pK = -1)
  /\ LET fate == ParentLanding(IF InverseQueued THEN "older" ELSE "absent") IN
       CASE fate = "drop" -> n' = n + 1 /\ pending' = "landed" /\ UNCHANGED <<pK, wK>>
         [] fate = "move" -> pK' = 1 /\ wK' = n + 1 /\ n' = n + 1 /\ pending' = "landed"
         [] fate = "refuse" -> pending' = "refused" /\ UNCHANGED <<pK, wK, n>>
  /\ UNCHANGED <<pP, wP, turned, cut, stacked>> /\ Theirs

PersonDelete ==
  /\ ~Waiting /\ cut = 0 /\ Shows
  /\ pK' = -1 /\ wK' = n + 1 /\ n' = n + 1 /\ cut' = n + 1 /\ stacked' = TRUE
  /\ UNCHANGED <<pP, wP, turned, pending>> /\ Theirs

PersonUndo ==
  /\ ~Waiting /\ stacked /\ stacked' = FALSE
  /\ IF wK = cut /\ Lands(Base(cut))
     THEN pK' = 1 /\ wK' = n + 1 /\ n' = n + 1 /\ turned' = turned + 2 ^ (n + 1)
     ELSE UNCHANGED <<pK, wK, n, turned>>
  /\ UNCHANGED <<pP, wP, pending, cut>> /\ Theirs

\* A step of the other tab is 10 times its edit plus the layer it deleted: 1 for P, 2 for K.
OtherDelete ==
  \E x \in {1, 2} :
    /\ (InverseQueued => x = (IF acts = 0 THEN 2 ELSE 1))
    /\ acts < 2 /\ (IF x = 1 THEN pP = 0 ELSE Shows)
    /\ t1' = IF theirs = 0 THEN 10 * (n + 1) + x ELSE t1
    /\ t2' = IF theirs = 1 THEN 10 * (n + 1) + x ELSE t2
    /\ theirs' = theirs + 1 /\ acts' = acts + 1 /\ n' = n + 1
    /\ IF x = 1
       THEN pP' = -1 /\ wP' = n + 1 /\ hid' = Shows /\ UNCHANGED <<pK, wK>>
       ELSE pK' = -1 /\ wK' = n + 1 /\ UNCHANGED <<pP, wP, hid>>
    /\ UNCHANGED <<turned, undid, pending, cut, stacked>>

Turn == n' = n + 1 /\ turned' = turned + 2 ^ (n + 1) /\ undid' = undid + 2 ^ (n + 1)
Wrote(w, e) == w = e \/ In(undid, w)

OtherUndo ==
  /\ ~InverseQueued /\ theirs > 0 /\ theirs' = theirs - 1
  /\ LET step == IF theirs = 2 THEN t2 ELSE t1
         x == step % 10
         e == step \div 10 IN
       IF x = 1
       THEN IF Wrote(wP, e)
            THEN pP' = 0 /\ wP' = n + 1 /\ Turn /\ UNCHANGED <<pK, wK>>
            ELSE UNCHANGED <<pK, pP, wK, wP, n, turned, undid>>
       ELSE IF Wrote(wK, e) /\ Lands(Base(e))
            THEN pK' = 1 /\ wK' = n + 1 /\ Turn /\ UNCHANGED <<pP, wP>>
            ELSE UNCHANGED <<pK, pP, wK, wP, n, turned, undid>>
  /\ UNCHANGED <<pending, cut, stacked, t1, t2, acts, hid>>

Next == PersonMove \/ QueueMoveInverse \/ Replay \/ PersonDelete \/ PersonUndo \/ OtherDelete \/ OtherUndo

Spec == Init /\ [][Next]_vars

\* An undo that brings P back shows K only when the delete of P hid it, or an undo has put K back into P since:
\* a layer another step deleted comes back with the undo of that step, one Ctrl+Z each, as in Figma.
OneStepAtATime == [][(pP = -1 /\ pP' = 0 /\ pK' = 1) => hid \/ In(turned, wK)]_vars

\* When P comes back, a K the person deleted, and nobody wrote since, still has the person's step that brings it back.
NeverLosesALayer == [][(pP = -1 /\ pP' = 0 /\ cut # 0 /\ wK = cut) => stacked]_vars

====

---- MODULE LineEnds ----
\* One connector's start and end beside the shape X its start may attach to, written by two tabs. Tab A deletes X,
\* undoes the delete and redoes it, and may send late (offline, or before it caught up). Tab B writes once, at any
\* time, and always shows what the server holds: it moves X, attaches the start to X, or moves the line's end.
\* The server holds whether X is on the deck (xOn), X's box (xBox, 0 or 1), the start (s: -1 attached to X, or a free
\* point: 0 and 1 where X's right side paints at box 0 and 1, 2 elsewhere) and the end (e, 0 or 1). gB says B wrote
\* the line's geometry last. atDel says the start was attached when X left the deck by a batch that wrote the line.
\* Tab A shows what it last caught up to (B's write is missing until seen) with its queued edits on top. An edit is a
\* slot: a for the first edit A makes, b for the second. A slot's kind is the delete (del), the undo of the delete
\* (undo) or the redo of that undo (redo). A run starts either fresh (A may delete, then undo) or with the delete and
\* its undo landed (A may redo). Each slot holds whether it writes the line (g), the start and end it writes (s, e), the
\* base of that write (gb), the start and end A showed when it made the edit (rs, re), and whether B's write was unseen
\* then (pre). A base is "pre" (read before B's write landed, or before A saw it), "post", "a" for the landing of slot
\* a, still queued, or "last" for a write that wins whatever landed before it.
\* Under Rule "tabView", the device frees an end only when the batch it sends leaves the end on a shape that leaves the
\* deck, at the point its own view painted, and the base names only the line's geometry; the server keeps an end that
\* names a dead shape. A refused turn drops a write to a property another tab wrote since the press.
\* Under Rule "deletesWin", the device frees every end its view shows on a shape that leaves the deck, at the point its
\* view painted, in a line write that wins (`freeLineEnds`). The deck frees an end still on a shape off the deck after
\* a batch where the shape's stored box paints (`freedInFold`), so a delete always lands. A refused turn keeps each end
\* the other tab did not change since the press, takes the other tab's end for the rest, and frees again against the
\* caught-up deck (`onStandingOnly`).
EXTENDS Integers

CONSTANT Rule

VARIABLES xOn, xBox, s, e, gB, atDel, other, seen, from, told,
  ka, qa, ga, sa, ea, gba, rsa, rea, prea,
  kb, qb, gbw, sb, eb, gbb, rsb, reb, preb

vars == <<xOn, xBox, s, e, gB, atDel, other, seen, from, told,
  ka, qa, ga, sa, ea, gba, rsa, rea, prea,
  kb, qb, gbw, sb, eb, gbb, rsb, reb, preb>>

Kinds == {"none", "del", "undo", "redo"}
States == {"none", "queued", "landed", "dropped"}
Bases == {"pre", "post", "a", "last"}

TypeOK ==
  /\ xOn \in BOOLEAN /\ xBox \in 0..1 /\ s \in -1..2 /\ e \in 0..1 /\ {gB, atDel, seen} \subseteq BOOLEAN
  /\ other \in {"none", "move", "attach", "end"} /\ from \in {"fresh", "undone"} /\ told \in {"none", "set aside"}
  /\ ka \in Kinds /\ kb \in Kinds /\ qa \in States /\ qb \in States
  /\ {ga, gbw, prea, preb} \subseteq BOOLEAN /\ {sa, sb, rsa, rsb} \subseteq -1..2 /\ {ea, eb, rea, reb} \subseteq 0..1
  /\ {gba, gbb} \subseteq Bases

On(k) == k = "undo"

\* What A last caught up to: the server without B's write until A sees it.
KS == IF other = "attach" /\ ~seen THEN 2 ELSE s
KE == IF other = "end" /\ ~seen THEN 0 ELSE e
KBox == IF other = "move" /\ ~seen THEN 0 ELSE xBox
SawB == other # "none" /\ seen
Fresh == IF SawB THEN "post" ELSE "pre"

\* What A shows: its queued edits on top of what it caught up to.
VOn == IF qb = "queued" THEN On(kb) ELSE IF qa = "queued" THEN On(ka) ELSE xOn
\* Under "deletesWin" the deck frees in A's view too an end a queued delete left on X, where A knows X's box, and an
\* undo queued after it does not write the line back.
AfterA ==
  IF qa = "queued" /\ ga THEN sa
  ELSE IF Rule = "deletesWin" /\ qa = "queued" /\ KS = -1 /\ ~On(ka) THEN KBox
  ELSE KS
VS == IF qb = "queued" /\ gbw THEN sb ELSE AfterA
VE == IF qb = "queued" /\ gbw THEN eb ELSE IF qa = "queued" /\ ga THEN ea ELSE KE

\* One end of `lineEndsBack`: put back what the step replaced if the end still holds what the step wrote.
Back(now, wrote, was) == IF now = wrote /\ was # wrote THEN was ELSE now

\* The line write a batch sends that takes X off the deck, from the line write `invert` asked for (g, ns, ne) with
\* its base.
Freed(g, ns, ne, base) ==
  LET start == IF g THEN ns ELSE VS
      end == IF g THEN ne ELSE VE
      frees == IF Rule = "tabView" THEN start = -1 ELSE VS = -1
      wins == IF Rule = "tabView" THEN base ELSE "last"
  IN IF frees THEN [g |-> TRUE, s |-> KBox, e |-> end, gb |-> wins] ELSE [g |-> g, s |-> ns, e |-> ne, gb |-> base]

Delete ==
  /\ from = "fresh" /\ ka = "none"
  /\ LET w == Freed(FALSE, 0, 0, Fresh) IN
       /\ ka' = "del" /\ qa' = "queued" /\ ga' = w.g /\ sa' = w.s /\ ea' = w.e
       /\ gba' = w.gb /\ rsa' = VS /\ rea' = VE /\ prea' = ~SawB
  /\ told' = "none"
  /\ UNCHANGED <<xOn, xBox, s, e, gB, atDel, other, seen, from, kb, qb, gbw, sb, eb, gbb, rsb, reb, preb>>

\* Undo the delete in slot a: put X back and each end that still holds what the delete wrote.
Undo ==
  /\ ka = "del" /\ qa \in {"queued", "landed"} /\ kb = "none"
  /\ UNCHANGED <<xOn, xBox, s, e, gB, atDel, other, seen, from, ka, qa, ga, sa, ea, gba, rsa, rea, prea>>
  /\ LET ns == Back(VS, sa, rsa)
         ne == Back(VE, ea, rea)
     IN /\ kb' = "undo" /\ qb' = "queued" /\ gbw' = (ga /\ <<ns, ne>> # <<VS, VE>>) /\ sb' = ns /\ eb' = ne
        /\ gbb' = (IF qa = "queued" /\ ga THEN "a" ELSE Fresh)
        /\ rsb' = VS /\ reb' = VE /\ preb' = ~SawB /\ told' = "none"

\* Redo, from a start where the delete and its undo landed: the undo wrote the start back onto X (-1) over the point
\* the delete freed it at (0), with the end at 0.
Redo ==
  /\ from = "undone" /\ ka = "none"
  /\ LET w == Freed(TRUE, Back(VS, -1, 0), Back(VE, 0, 0), Fresh) IN
       /\ ka' = "redo" /\ qa' = "queued" /\ ga' = (w.g /\ <<w.s, w.e>> # <<VS, VE>>) /\ sa' = w.s /\ ea' = w.e
       /\ gba' = w.gb /\ rsa' = VS /\ rea' = VE /\ prea' = ~SawB
  /\ told' = "none"
  /\ UNCHANGED <<xOn, xBox, s, e, gB, atDel, other, seen, from, kb, qb, gbw, sb, eb, gbb, rsb, reb, preb>>

\* Whether the server takes a batch, and what it holds after.
Refused(g, gbase) == g /\ gbase = "pre" /\ gB

Lands(k, g, ws, we) ==
  LET kept == IF ~g THEN s ELSE IF ws = -1 /\ ~On(k) THEN s ELSE ws
  IN /\ xOn' = On(k)
     /\ s' = (IF Rule = "deletesWin" /\ kept = -1 /\ ~On(k) THEN xBox ELSE kept)
     /\ e' = (IF g THEN we ELSE e)
     /\ gB' = (gB /\ ~g)
     /\ atDel' = (IF ~On(k) /\ xOn THEN s = -1 /\ g ELSE atDel)
     /\ seen' = TRUE

Settled == IF other = "none" THEN "pre" ELSE "post"

\* A refused turn sent again: today it drops the line write if B wrote the line since the press. Under the new rule it
\* keeps each end B left as A read it at the press, takes B's end for the other, and frees again on what the server
\* holds when the batch takes X off the deck.
Again(k, g, ws, we, rs, re, pre) ==
  LET theirs == g /\ gB /\ pre
      ns == IF s = rs THEN ws ELSE s
      ne == IF e = re THEN we ELSE e
      frees == ~On(k) /\ xOn /\ s = -1
  IN IF Rule = "tabView"
       THEN [g |-> g /\ ~theirs, s |-> ws, e |-> we, gb |-> "pre", changed |-> theirs]
     ELSE IF frees
       THEN [g |-> TRUE, s |-> xBox, e |-> (IF theirs THEN ne ELSE we), gb |-> "last", changed |-> TRUE]
     ELSE IF theirs
       THEN [g |-> <<ns, ne>> # <<s, e>>, s |-> ns, e |-> ne, gb |-> "post", changed |-> TRUE]
     ELSE [g |-> g, s |-> ws, e |-> we, gb |-> "pre", changed |-> FALSE]

KeepB == UNCHANGED <<kb, qb, gbw, sb, eb, gbb, rsb, reb, preb>>
KeepA == UNCHANGED <<ka, qa, ga, sa, ea, gba, rsa, rea, prea>>

SendA ==
  /\ qa = "queued"
  /\ IF ~Refused(ga, gba)
       THEN /\ Lands(ka, ga, sa, ea) /\ qa' = "landed" /\ told' = "none"
            /\ gbb' = (IF gbb = "a" THEN Settled ELSE gbb)
            /\ UNCHANGED <<xBox, other, from, ka, ga, sa, ea, gba, rsa, rea, prea, kb, qb, gbw, sb, eb, rsb, reb, preb>>
       ELSE LET w == Again(ka, ga, sa, ea, rsa, rea, prea) IN
         IF ka = "redo" /\ w.changed /\ ~Refused(w.g, w.gb)
           THEN /\ Lands(ka, w.g, w.s, w.e) /\ qa' = "landed" /\ told' = "none"
                /\ ga' = w.g /\ sa' = w.s /\ ea' = w.e /\ gba' = w.gb
                /\ UNCHANGED <<xBox, other, from, ka, rsa, rea, prea>> /\ KeepB
           ELSE /\ qa' = "dropped" /\ told' = "set aside" /\ seen' = TRUE
                /\ qb' = (IF qb = "queued" THEN "dropped" ELSE qb)
                /\ UNCHANGED <<xOn, xBox, s, e, gB, atDel, other, from, ka, ga, sa, ea, gba, rsa, rea, prea>>
                /\ UNCHANGED <<kb, gbw, sb, eb, gbb, rsb, reb, preb>>

SendB ==
  /\ qb = "queued" /\ qa # "queued"
  /\ IF ~Refused(gbw, gbb)
       THEN /\ Lands(kb, gbw, sb, eb) /\ qb' = "landed" /\ told' = "none"
            /\ UNCHANGED <<xBox, other, from>> /\ KeepA /\ UNCHANGED <<kb, gbw, sb, eb, gbb, rsb, reb, preb>>
       ELSE LET w == Again(kb, gbw, sb, eb, rsb, reb, preb) IN
         IF w.changed /\ ~Refused(w.g, w.gb)
           THEN /\ Lands(kb, w.g, w.s, w.e) /\ qb' = "landed" /\ told' = "none"
                /\ gbw' = w.g /\ sb' = w.s /\ eb' = w.e /\ gbb' = w.gb
                /\ UNCHANGED <<xBox, other, from, kb, rsb, reb, preb>> /\ KeepA
           ELSE /\ qb' = "dropped" /\ told' = "set aside" /\ seen' = TRUE
                /\ UNCHANGED <<xOn, xBox, s, e, gB, atDel, other, from>> /\ KeepA
                /\ UNCHANGED <<kb, gbw, sb, eb, gbb, rsb, reb, preb>>

CatchUp ==
  /\ other # "none" /\ ~seen
  /\ seen' = TRUE /\ told' = "none"
  /\ UNCHANGED <<xOn, xBox, s, e, gB, atDel, other, from>> /\ KeepA /\ KeepB

\* B's one write, on what the server holds.
BWrites(kind) ==
  /\ other = "none" /\ other' = kind /\ seen' = FALSE /\ told' = "none"
  /\ UNCHANGED <<xOn, atDel, from>> /\ KeepA /\ KeepB

BMove == xOn /\ BWrites("move") /\ xBox' = 1 /\ UNCHANGED <<s, e, gB>>
BAttach == xOn /\ s # -1 /\ BWrites("attach") /\ s' = -1 /\ gB' = TRUE /\ UNCHANGED <<xBox, e>>
BEnd == BWrites("end") /\ e' = 1 /\ gB' = TRUE /\ UNCHANGED <<xBox, s>>

Init ==
  \E start \in {"fresh", "undone"}, free \in BOOLEAN :
    /\ from = start /\ (start = "undone" => ~free)
    /\ xOn = TRUE /\ xBox = 0 /\ s = (IF free THEN 2 ELSE -1) /\ e = 0
    /\ gB = FALSE /\ atDel = FALSE /\ other = "none" /\ seen = FALSE /\ told = "none"
    /\ ka = "none" /\ qa = "none" /\ ga = FALSE /\ sa = 0 /\ ea = 0 /\ gba = "pre" /\ rsa = 0 /\ rea = 0
    /\ prea = FALSE /\ kb = "none" /\ qb = "none" /\ gbw = FALSE /\ sb = 0 /\ eb = 0 /\ gbb = "pre" /\ rsb = 0 /\ reb = 0
    /\ preb = FALSE

Next == Delete \/ Undo \/ Redo \/ SendA \/ SendB \/ CatchUp \/ BMove \/ BAttach \/ BEnd

Spec == Init /\ [][Next]_vars

\* An end on a shape names a shape on the deck: never a dead id painted from a stale box.
NoDeadEnd == s = -1 => xOn

\* A delete or redo A sends always lands, and no tab is ever told its change was set aside.
DeletesWin == [][qa = "queued" /\ qa' # "queued" => qa' = "landed"]_vars
NeverSetAside == told # "set aside"

\* A freed end sits where X's right side painted at one of its boxes, on the server or in the view of the tab that took
\* X away when it pressed, never anywhere else.
FreesWherePainted == [][s = -1 /\ s' # -1 => s' \in 0..1]_vars

\* The undo of a delete that freed the start in its own line write puts the start back on X, since no one else can
\* write it meanwhile. An end the deck freed is not in the delete, so its undo leaves it free.
RestoresAttachment == [][~xOn /\ xOn' /\ atDel => s' = -1]_vars

\* B's end stays unless a batch that takes X off the deck writes the whole line after it: the last write wins.
KeepsTheirEnd == [][gB /\ e = 1 /\ e' # 1 => xOn /\ ~xOn']_vars

====

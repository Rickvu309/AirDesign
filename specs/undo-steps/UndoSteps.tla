---- MODULE UndoSteps ----
\* One device's undo and redo stacks (`turn` in packages/live/src/doom-deck.ts) over three properties on two
\* layers: the title's text T, the title's parent P and the card's box C. T and C start as 0. P is 1 while the
\* title stands, 0 once it is deleted and 2 while it is not made yet.
\* When the title is in the file, the person makes two steps before the first press: a nudge of the card to 1,
\* then a step that writes 2 to T, C or both in one edit, or types 2 in the title and deletes it in the same
\* edit, as leaving a text box emptied does. When it is not, the person makes one step: it makes the title with
\* text 1 and nudges the card to 1. A push drops a write that would not change its property and makes no step
\* when none is left (`changingWrites`). Once the person has a step and before the first press, another tab may
\* write T or C once, to 1 or 2, so its value is free to equal one the person left. Once the person has a step,
\* it may delete the title once, at any time the title stands. A deleted layer keeps its properties, but the
\* deck refuses any write to them (`missing` in packages/doom/src/apply-edit.ts).
\* Edits are numbered from 1 in the order they land. wT, wP and wC name the edit that wrote each property
\* last, others is the set of the other tab's edits and turned the set of turns that landed, each as bits.
\* An undo looks at the top step. It puts back the value the step replaced on each property the step wrote
\* whose last writer is the step or a turn that landed, and whose layer still stands or comes back in the same
\* undo (`invert` in packages/doom/src/invert.ts). Of a layer the step made it puts back only the parent, which
\* deletes it. With none, it takes the step off the stack and answers nothing, as Figma does nothing for an
\* undo of an edit to a layer someone else deleted. Otherwise it writes a move that puts the title back first
\* and a delete last. The deck refuses the whole turn if a write reaches a deleted layer, and the step stays on
\* top. A turn that lands takes the step off and pushes on the redo stack a step that wrote what it put back. A
\* redo does the same from the redo stack.
\* A stack is a number in base 8 whose last digit is the top step's slot: 1 and 2 for the person's steps, 3 to
\* 5 for the step each landed turn pushed. A slot holds 10000 times the step's edit, 1000 times the properties
\* it wrote (1 for T, 2 for C, 4 for P, summed), 100 times the P it replaced, 10 times the T and the C.
EXTENDS Integers

VARIABLES xT, xP, xC, wT, wP, wC, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, wrote, deleted,
  presses, told

vars == <<xT, xP, xC, wT, wP, wC, n, us, rs, s1, s2, s3, s4, s5, turned, others, made, turns, wrote, deleted,
  presses, told>>

Props == {"T", "P", "C"}
X(p) == CASE p = "T" -> xT [] p = "P" -> xP [] OTHER -> xC
W(p) == CASE p = "T" -> wT [] p = "P" -> wP [] OTHER -> wC
Bit(p) == CASE p = "T" -> 1 [] p = "C" -> 2 [] OTHER -> 4
In(bits, id) == (bits \div (2 ^ id)) % 2 = 1
Slot(k) == CASE k = 1 -> s1 [] k = 2 -> s2 [] k = 3 -> s3 [] k = 4 -> s4 [] OTHER -> s5
Edit(k) == Slot(k) \div 10000
Wrote(k) == {p \in Props : (((Slot(k) \div 1000) % 10) \div Bit(p)) % 2 = 1}
Replaced(k, p) == CASE p = "P" -> (Slot(k) \div 100) % 10 [] p = "T" -> (Slot(k) \div 10) % 10 [] OTHER -> Slot(k) % 10
Bits(ps) == (IF "T" \in ps THEN 1 ELSE 0) + (IF "C" \in ps THEN 2 ELSE 0) + (IF "P" \in ps THEN 4 ELSE 0)
Pack(e, ps, p, t, c) == 10000 * e + 1000 * Bits(ps) + 100 * p + 10 * t + c

Stands(p) == p # "T" \/ xP = 1
Owned(k, p) == W(p) = Edit(k) \/ In(turned, W(p))
Mine(k) == {p \in Wrote(k) : Owned(k, p)}
Back(k) == "P" \in Mine(k) /\ Replaced(k, "P") = 1
Made(k) == "P" \in Wrote(k) /\ Replaced(k, "P") = 2
Puts(k) == {p \in Mine(k) : p # "T" \/ (~Made(k) /\ (xP = 1 \/ Back(k)))}
Put(k, p) == IF p = "P" /\ Replaced(k, p) = 2 THEN 0 ELSE Replaced(k, p)

\* Whether the title stands when the turn writes its text: a move that puts it back goes first, a delete last.
TitleAtText(k) == Back(k) \/ xP = 1
Refused(k) == "T" \in Puts(k) /\ ~TitleAtText(k)

TypeOK ==
  /\ {xT, xC} \subseteq 0..2 /\ xP \in 0..2 /\ {wT, wP, wC} \subseteq 0..7 /\ n \in 0..7
  /\ us \in 0..32767 /\ rs \in 0..32767
  /\ {s1, s2, s3, s4, s5} \subseteq 0..77222
  /\ turned \in 0..255 /\ others \in 0..255
  /\ made \in 0..2 /\ turns \in 0..3 /\ wrote \in BOOLEAN /\ deleted \in BOOLEAN /\ presses \in 0..3
  /\ told \in {"none", "undone", "redone", "nothing to undo", "nothing to redo", "undo refused", "redo refused"}

Init ==
  /\ xT = 0 /\ xP \in {1, 2} /\ xC = 0 /\ wT = 0 /\ wP = 0 /\ wC = 0 /\ n = 0 /\ us = 0 /\ rs = 0
  /\ s1 = 0 /\ s2 = 0 /\ s3 = 0 /\ s4 = 0 /\ s5 = 0
  /\ turned = 0 /\ others = 0 /\ made = 0 /\ turns = 0 /\ wrote = FALSE /\ deleted = FALSE /\ presses = 0
  /\ told = "none"

Writes(ps, value(_), by) ==
  /\ xT' = IF "T" \in ps THEN value("T") ELSE xT
  /\ xP' = IF "P" \in ps THEN value("P") ELSE xP
  /\ xC' = IF "C" \in ps THEN value("C") ELSE xC
  /\ wT' = IF "T" \in ps THEN by ELSE wT
  /\ wP' = IF "P" \in ps THEN by ELSE wP
  /\ wC' = IF "C" \in ps THEN by ELSE wC

Steps ==
  IF made = 0 THEN (IF xP = 2 THEN {{"T", "P", "C"}} ELSE {{"C"}}) ELSE {{"T"}, {"C"}, {"T", "C"}, {"T", "P"}}

PersonStep ==
  \E ps \in Steps :
    LET v == made + 1
        value(p) == IF p = "P" THEN (IF xP = 2 THEN 1 ELSE 0) ELSE v
        kept == {p \in ps : X(p) # value(p)}
    IN
    /\ made < 2 /\ presses = 0 /\ kept # {} /\ \A p \in kept : Stands(p) \/ xP = 2
    /\ Writes(kept, value, n + 1)
    /\ s1' = IF made = 0 THEN Pack(n + 1, kept, xP, xT, xC) ELSE s1
    /\ s2' = IF made = 1 THEN Pack(n + 1, kept, xP, xT, xC) ELSE s2
    /\ us' = us * 8 + made + 1 /\ rs' = 0
    /\ n' = n + 1 /\ made' = (IF xP = 2 THEN 2 ELSE made + 1) /\ told' = "none"
    /\ UNCHANGED <<s3, s4, s5, turned, others, turns, wrote, deleted, presses>>

OtherWrite ==
  \E p \in {"T", "C"}, v \in {1, 2} :
    LET value(q) == v IN
    /\ ~wrote /\ made > 0 /\ presses = 0 /\ X(p) # v /\ Stands(p)
    /\ Writes({p}, value, n + 1)
    /\ others' = others + 2 ^ (n + 1)
    /\ n' = n + 1 /\ wrote' = TRUE /\ told' = "none"
    /\ UNCHANGED <<us, rs, s1, s2, s3, s4, s5, turned, made, turns, deleted, presses>>

OtherDelete ==
  LET value(q) == 0 IN
  /\ ~deleted /\ made > 0 /\ xP = 1
  /\ Writes({"P"}, value, n + 1)
  /\ deleted' = TRUE
  /\ others' = others + 2 ^ (n + 1)
  /\ n' = n + 1 /\ told' = "none"
  /\ UNCHANGED <<us, rs, s1, s2, s3, s4, s5, turned, made, turns, wrote, presses>>

\* Turn the step in slot k: put back what it replaced on Puts(k) and fill the next turn slot with the step that
\* puts it back again.
Lands(k) ==
  LET value(p) == Put(k, p)
      back == Pack(n + 1, Puts(k), xP, xT, xC)
  IN
  /\ Writes(Puts(k), value, n + 1)
  /\ s3' = IF turns = 0 THEN back ELSE s3
  /\ s4' = IF turns = 1 THEN back ELSE s4
  /\ s5' = IF turns = 2 THEN back ELSE s5
  /\ turned' = turned + 2 ^ (n + 1)
  /\ n' = n + 1 /\ turns' = turns + 1

Kept == UNCHANGED <<xT, xP, xC, wT, wP, wC, n, s3, s4, s5, turned, turns>>

Undo ==
  /\ presses < 3 /\ us > 0
  /\ presses' = presses + 1
  /\ LET k == us % 8 IN
       CASE Puts(k) = {} -> us' = us \div 8 /\ told' = "nothing to undo" /\ Kept /\ UNCHANGED rs
         [] Refused(k) -> told' = "undo refused" /\ Kept /\ UNCHANGED <<us, rs>>
         [] OTHER -> Lands(k) /\ us' = us \div 8 /\ rs' = rs * 8 + 3 + turns /\ told' = "undone"
  /\ UNCHANGED <<s1, s2, others, made, wrote, deleted>>

Redo ==
  /\ presses < 3 /\ rs > 0
  /\ presses' = presses + 1
  /\ LET k == rs % 8 IN
       CASE Puts(k) = {} -> rs' = rs \div 8 /\ told' = "nothing to redo" /\ Kept /\ UNCHANGED us
         [] Refused(k) -> told' = "redo refused" /\ Kept /\ UNCHANGED <<us, rs>>
         [] OTHER -> Lands(k) /\ rs' = rs \div 8 /\ us' = us * 8 + 3 + turns /\ told' = "redone"
  /\ UNCHANGED <<s1, s2, others, made, wrote, deleted>>

Next == PersonStep \/ OtherWrite \/ OtherDelete \/ Undo \/ Redo

Spec == Init /\ [][Next]_vars

RECURSIVE Waits(_)
Waits(stack) == IF stack = 0 THEN {} ELSE {Edit(stack % 8)} \union Waits(stack \div 8)

\* Each property of the step is on a deleted layer, or the other tab or another step still waiting on a stack
\* wrote it last: nothing of the step shows.
Spent(k) == \A p \in Wrote(k) : ~Stands(p) \/ In(others, W(p)) \/ (W(p) # Edit(k) /\ W(p) \in Waits(us) \union Waits(rs))

\* A press that finds nothing to put back takes off only a step nothing of which still shows, and a turn that
\* lands puts back the value the step replaced on every property it names.
NeverLosesAStep ==
  [][/\ (told' = "nothing to undo" /\ us > 0) => Spent(us % 8)
     /\ (told' = "nothing to redo" /\ rs > 0) => Spent(rs % 8)
     /\ (told' = "undone" /\ us > 0) => \A p \in Puts(us % 8) : X(p)' = Put(us % 8, p)
     /\ (told' = "redone" /\ rs > 0) => \A p \in Puts(rs % 8) : X(p)' = Put(rs % 8, p)]_vars

\* A turn never writes over a property whose last writer is the other tab, whatever value either left.
NeverCoversTheirs ==
  [][\A p \in Props : (W(p)' # W(p) /\ In(turned', W(p)')) => ~In(others, W(p))]_vars

\* Every press takes a step off its stack, so the next press reaches the step below it: neither a layer another
\* tab deleted nor a step that deletes its own layer holds the steps under it.
NeverStuck == [][presses' > presses => <<us', rs'>> # <<us, rs>>]_vars

====

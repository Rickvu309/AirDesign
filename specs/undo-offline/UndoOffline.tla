---- MODULE UndoOffline ----
\* One device's undo and redo stacks (`turn` in packages/live/src/doom-deck.ts) while the tab is offline, beside
\* another tab that changes the deck once, and the replay of the queued turns on reconnect (`drain`). Three
\* properties: the title's text T, the card's box C and the deck's name N, all 0 in the file. The title has the
\* role `title` and the deck name follows it, so a write to T always comes with a write to N. The person has made
\* two steps, both saved: a nudge of the card to 1, then a step that writes 2 to T and N, or to T, N and C in one
\* edit. The tab may go offline once and come back. Another tab may, once and at any time, delete the title, which
\* sets the name back to blank (0) so it writes N too unless N is blank already, or rename the deck (N becomes 3),
\* or retype the title (T and N become 3, the name follows). Online, the tab sees that edit at once; offline, it
\* still shows the old values until it reconnects.
\* An undo looks at the top step and, against what the tab shows, puts back the value the step replaced on each
\* property whose last writer is the step or a turn, and whose layer the tab shows (`invert`). With none, it takes
\* the step off and answers nothing. Otherwise the turn paints at once and lands, or, offline, waits in the queue,
\* and the step that puts it back goes on the other stack. A redo does the same from the redo stack.
\* On reconnect the queue replays in order. The deck refuses a write to a deleted layer (`missing`) and a write
\* whose base is older than what the other tab wrote (`stale`), the whole edit either way. Whatever content
\* refusal catching up resolves, a refused turn drops each write on a layer that does not stand and each write on
\* a property the other tab wrote since the press (`onStandingOnly`, the same judge as `invert` and
\* `onStandingLayers`) and is sent again with the rest. A turn with nothing left is taken off quietly with the
\* step that would put it back, as an undo online answers nothing.
\* Edits are numbered from 1 in the order they are made. xT, xC, xN and xP are what the server holds (xP is 1
\* while the title stands, 0 once deleted), wT, wC and wN the edit that wrote each last. vT, vC, vN, vwT, vwC and
\* vwN are what the tab shows. turned is the set of turns and others the other tab's edits, each as bits. qa and
\* qb are the queued turns, oldest first, each 10000 times its edit, 1000 times the properties it writes (1 for T,
\* 2 for C, 4 for N, summed), 100 times the T, 10 times the C and the N it writes.
\* A stack is a number in base 8 whose last digit is the top step's slot: 1 and 2 for the person's steps, 3 to 5
\* for the step each turn pushed. A slot holds 10000 times the step's edit, 1000 times the properties it wrote,
\* 100 times the T, 10 times the C and the N it replaced.
EXTENDS Integers

VARIABLES xT, xC, xN, xP, wT, wC, wN, vT, vC, vN, vwT, vwC, vwN, seen, online, wentOff, n, us, rs, s1, s2, s3, s4, s5, turned,
  others, turns, presses, qa, qb, told

vars == <<xT, xC, xN, xP, wT, wC, wN, vT, vC, vN, vwT, vwC, vwN, seen, online, wentOff, n, us, rs, s1, s2, s3, s4, s5, turned,
  others, turns, presses, qa, qb, told>>

Props == {"T", "C", "N"}
Bit(p) == CASE p = "T" -> 1 [] p = "C" -> 2 [] OTHER -> 4
In(bits, id) == (bits \div (2 ^ id)) % 2 = 1
Bits(ps) == (IF "T" \in ps THEN 1 ELSE 0) + (IF "C" \in ps THEN 2 ELSE 0) + (IF "N" \in ps THEN 4 ELSE 0)
Pack(e, ps, t, c, m) == 10000 * e + 1000 * Bits(ps) + 100 * t + 10 * c + m
EditOf(s) == s \div 10000
PropsOf(s) == {p \in Props : (((s \div 1000) % 10) \div Bit(p)) % 2 = 1}
ValueOf(s, p) == CASE p = "T" -> (s \div 100) % 10 [] p = "C" -> (s \div 10) % 10 [] OTHER -> s % 10

Slot(k) == CASE k = 1 -> s1 [] k = 2 -> s2 [] k = 3 -> s3 [] k = 4 -> s4 [] OTHER -> s5
Edit(k) == EditOf(Slot(k))

X(p) == CASE p = "T" -> xT [] p = "C" -> xC [] OTHER -> xN
W(p) == CASE p = "T" -> wT [] p = "C" -> wC [] OTHER -> wN
V(p) == CASE p = "T" -> vT [] p = "C" -> vC [] OTHER -> vN
VW(p) == CASE p = "T" -> vwT [] p = "C" -> vwC [] OTHER -> vwN

TitleShown == xP = 1 \/ ~seen
Puts(k) == {p \in PropsOf(Slot(k)) : (VW(p) = Edit(k) \/ In(turned, VW(p))) /\ (p # "T" \/ TitleShown)}

TypeOK ==
  /\ {xT, xC, xN, vT, vC, vN} \subseteq 0..3 /\ xP \in 0..1 /\ {wT, wC, wN, vwT, vwC, vwN} \subseteq 0..7 /\ n \in 0..7
  /\ {seen, online, wentOff} \subseteq BOOLEAN
  /\ us \in 0..4095 /\ rs \in 0..4095 /\ {s1, s2, s3, s4, s5} \subseteq 0..77333
  /\ turned \in 0..255 /\ others \in 0..255 /\ turns \in 0..3 /\ presses \in 0..3 /\ {qa, qb} \subseteq 0..77333
  /\ told \in {"none", "undone", "redone", "nothing to undo", "nothing to redo", "set aside"}

Init ==
  \E ps \in {{"T"}, {"T", "C"}} :
    /\ xT = 2 /\ xC = (IF "C" \in ps THEN 2 ELSE 1) /\ xN = 2 /\ xP = 1
    /\ wT = 2 /\ wC = (IF "C" \in ps THEN 2 ELSE 1) /\ wN = 2
    /\ vT = xT /\ vC = xC /\ vN = xN /\ vwT = wT /\ vwC = wC /\ vwN = wN
    /\ seen = FALSE /\ online = TRUE /\ wentOff = FALSE /\ n = 2
    /\ us = 1 * 8 + 2 /\ rs = 0 /\ s1 = Pack(1, {"C"}, 0, 0, 0) /\ s2 = Pack(2, ps \union {"N"}, 0, 1, 0)
    /\ s3 = 0 /\ s4 = 0 /\ s5 = 0
    /\ turned = 0 /\ others = 0 /\ turns = 0 /\ presses = 0 /\ qa = 0 /\ qb = 0 /\ told = "none"

\* Turn the step in slot k: paint what it replaced on Puts(k), land it online or queue it offline, and fill the
\* next turn slot with the step that puts it back again.
Turn(k) ==
  LET e == n + 1
      ps == Puts(k)
      put(p) == IF p \in ps THEN ValueOf(Slot(k), p) ELSE V(p)
      by(p) == IF p \in ps THEN e ELSE VW(p)
      back == Pack(e, ps, vT, vC, vN)
  IN
  /\ vT' = put("T") /\ vC' = put("C") /\ vN' = put("N") /\ vwT' = by("T") /\ vwC' = by("C") /\ vwN' = by("N")
  /\ IF online
       THEN /\ xT' = put("T") /\ xC' = put("C") /\ xN' = put("N")
            /\ wT' = by("T") /\ wC' = by("C") /\ wN' = by("N") /\ UNCHANGED <<qa, qb>>
       ELSE /\ UNCHANGED <<xT, xC, xN, wT, wC, wN>>
            /\ qa' = (IF qa = 0 THEN Pack(e, ps, put("T"), put("C"), put("N")) ELSE qa)
            /\ qb' = (IF qa = 0 THEN 0 ELSE Pack(e, ps, put("T"), put("C"), put("N")))
  /\ s3' = (IF turns = 0 THEN back ELSE s3)
  /\ s4' = (IF turns = 1 THEN back ELSE s4)
  /\ s5' = (IF turns = 2 THEN back ELSE s5)
  /\ turned' = turned + 2 ^ e
  /\ n' = e /\ turns' = turns + 1

Kept == UNCHANGED <<xT, xC, xN, wT, wC, wN, vT, vC, vN, vwT, vwC, vwN, n, s3, s4, s5, turned, turns, qa, qb>>

Pressed == /\ presses < 2 /\ (online \/ qb = 0) /\ presses' = presses + 1

Undo ==
  /\ Pressed /\ us > 0
  /\ LET k == us % 8 IN
       IF Puts(k) = {} THEN us' = us \div 8 /\ told' = "nothing to undo" /\ Kept /\ UNCHANGED rs
       ELSE Turn(k) /\ us' = us \div 8 /\ rs' = rs * 8 + 3 + turns /\ told' = "undone"
  /\ UNCHANGED <<xP, seen, online, wentOff, s1, s2, others>>

Redo ==
  /\ Pressed /\ rs > 0
  /\ LET k == rs % 8 IN
       IF Puts(k) = {} THEN rs' = rs \div 8 /\ told' = "nothing to redo" /\ Kept /\ UNCHANGED us
       ELSE Turn(k) /\ rs' = rs \div 8 /\ us' = us * 8 + 3 + turns /\ told' = "redone"
  /\ UNCHANGED <<xP, seen, online, wentOff, s1, s2, others>>

\* The other tab's one edit: delete the title, rename the deck, or retype the title. It writes the edit's own
\* number as the last writer of each property it sets.
OtherEdit(t, m, p) ==
  /\ xT' = (IF t > 0 THEN t ELSE xT) /\ xN' = m /\ xP' = p
  /\ wT' = (IF t > 0 THEN n + 1 ELSE wT) /\ wN' = (IF m # xN THEN n + 1 ELSE wN)
  /\ others' = others + 2 ^ (n + 1) /\ n' = n + 1
  /\ vT' = (IF online /\ t > 0 THEN t ELSE vT) /\ vN' = (IF online THEN m ELSE vN)
  /\ vwT' = (IF online /\ t > 0 THEN n + 1 ELSE vwT)
  /\ vwN' = (IF online /\ m # xN THEN n + 1 ELSE vwN)
  /\ seen' = (IF p = 0 THEN online ELSE seen)
  /\ told' = "none"
  /\ UNCHANGED <<xC, wC, vC, vwC, online, wentOff, us, rs, s1, s2, s3, s4, s5, turned, turns, presses, qa, qb>>

OtherDelete == others = 0 /\ OtherEdit(0, 0, 0)
OtherRename == others = 0 /\ OtherEdit(0, 3, 1)
OtherRetype == others = 0 /\ OtherEdit(3, 3, 1)

GoOffline ==
  /\ online /\ ~wentOff
  /\ online' = FALSE /\ wentOff' = TRUE /\ told' = "none"
  /\ UNCHANGED <<xT, xC, xN, xP, wT, wC, wN, vT, vC, vN, vwT, vwC, vwN, seen, n, us, rs, s1, s2, s3, s4, s5, turned, others, turns,
       presses, qa, qb>>

RECURSIVE Without(_, _)
Without(stack, e) ==
  IF stack = 0 THEN 0
  ELSE LET rest == Without(stack \div 8, e) IN IF Edit(stack % 8) = e THEN rest ELSE rest * 8 + (stack % 8)

\* What a queued turn sends once refused, whichever content refusal it was: only its writes on a layer that stands
\* and on a property the other tab did not write since the press.
Theirs == {p \in Props : In(others, W(p))} \union (IF xP = 0 THEN {"T"} ELSE {})
Sent(q) == PropsOf(q) \ Theirs
Gone(q) == q # 0 /\ Sent(q) = {}
Last(p) == IF p \in Sent(qb) THEN qb ELSE IF p \in Sent(qa) THEN qa ELSE 0
Landed(p) == IF Last(p) = 0 THEN X(p) ELSE ValueOf(Last(p), p)
LandedBy(p) == IF Last(p) = 0 THEN W(p) ELSE EditOf(Last(p))
Left(stack) ==
  LET once == IF Gone(qa) THEN Without(stack, EditOf(qa)) ELSE stack IN
  IF Gone(qb) THEN Without(once, EditOf(qb)) ELSE once

Reconnect ==
  /\ ~online
  /\ online' = TRUE /\ seen' = TRUE /\ told' = "none"
  /\ xT' = Landed("T") /\ xC' = Landed("C") /\ xN' = Landed("N")
  /\ wT' = LandedBy("T") /\ wC' = LandedBy("C") /\ wN' = LandedBy("N")
  /\ vT' = Landed("T") /\ vC' = Landed("C") /\ vN' = Landed("N")
  /\ vwT' = LandedBy("T") /\ vwC' = LandedBy("C") /\ vwN' = LandedBy("N")
  /\ us' = Left(us) /\ rs' = Left(rs) /\ qa' = 0 /\ qb' = 0
  /\ UNCHANGED <<xP, wentOff, n, s1, s2, s3, s4, s5, turned, others, turns, presses>>

Next == Undo \/ Redo \/ OtherDelete \/ OtherRename \/ OtherRetype \/ GoOffline \/ Reconnect

Spec == Init /\ [][Next]_vars

RECURSIVE Waits(_)
Waits(stack) == IF stack = 0 THEN {} ELSE {Edit(stack % 8)} \union Waits(stack \div 8)

\* Online with nothing queued, every value the person sees that their own step or turn wrote last can still be
\* turned back: the edit that wrote it waits on a stack.
NeverLosesAStep ==
  online =>
    \A p \in Props : (p # "T" \/ xP = 1) /\ W(p) > 0 /\ ~In(others, W(p)) => W(p) \in Waits(us) \union Waits(rs)

\* Reconnecting moves no value the person sees on a layer that still stands, and that the other tab did not write:
\* a turn made offline lands what it painted there, so nothing jumps back without a notice. What the other tab
\* wrote, like the name it set back, is new to the tab, not a jump.
NothingJumpsBack ==
  [][Reconnect => \A p \in Props : (p # "T" \/ xP = 1) /\ ~In(others, W(p)) => X(p)' = V(p)]_vars

\* The tab and the server agree once the queue has replayed.
Agreed == online => vT = xT /\ vC = xC /\ vN = xN /\ vwT = wT /\ vwC = wC /\ vwN = wN

====

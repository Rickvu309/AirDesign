---- MODULE Usage ----
EXTENDS Integers

VARIABLES spent, hold, turn, week, outside

vars == <<spent, hold, turn, week, outside>>

Allowance == 2000000000
Half == 1000000000
Whole == 2000000000
SearchHold == 1010000000
UsHold == 1100000000

TypeOK ==
  /\ spent \in {0, Half, Whole, SearchHold, UsHold}
  /\ hold \in {0, Half, Whole, SearchHold, UsHold}
  /\ turn \in {"none", "a"}
  /\ week \in {0, 1}
  /\ outside \in {0, 1}

HoldTracksTurn ==
  \/ (turn = "none" /\ hold = 0)
  \/ (turn = "a" /\ hold \in {Half, Whole, SearchHold, UsHold})

WithinAllowance ==
  /\ spent <= Allowance
  /\ spent + hold <= Allowance

Charge(cost) == IF cost < hold THEN cost ELSE hold

Init ==
  /\ spent = 0
  /\ hold = 0
  /\ turn = "none"
  /\ week = 0
  /\ outside = 0

ReserveHalf ==
  /\ turn = "none"
  /\ spent <= Allowance - Half
  /\ turn' = "a"
  /\ hold' = Half
  /\ UNCHANGED <<spent, week, outside>>

ReserveAll ==
  /\ turn = "none"
  /\ spent <= Allowance - Whole
  /\ turn' = "a"
  /\ hold' = Whole
  /\ UNCHANGED <<spent, week, outside>>

ReserveZero ==
  UNCHANGED vars

ReserveHalfRefused ==
  /\ (turn /= "none" \/ spent > Allowance - Half)
  /\ UNCHANGED vars

ReserveAllRefused ==
  /\ (turn /= "none" \/ spent > Allowance - Whole)
  /\ UNCHANGED vars

ReserveSearch ==
  /\ turn = "none"
  /\ spent <= Allowance - SearchHold
  /\ turn' = "a"
  /\ hold' = SearchHold
  /\ UNCHANGED <<spent, week, outside>>

ReserveSearchRefused ==
  /\ (turn /= "none" \/ spent > Allowance - SearchHold)
  /\ UNCHANGED vars

ReserveUs ==
  /\ turn = "none"
  /\ spent <= Allowance - UsHold
  /\ turn' = "a"
  /\ hold' = UsHold
  /\ UNCHANGED <<spent, week, outside>>

ReserveUsRefused ==
  /\ (turn /= "none" \/ spent > Allowance - UsHold)
  /\ UNCHANGED vars

SettleHalf ==
  /\ turn = "a"
  /\ spent \in {0, Half}
  /\ spent' = IF spent = 0 THEN Half ELSE Whole
  /\ hold' = 0
  /\ turn' = "none"
  /\ UNCHANGED <<week, outside>>

SettleAll ==
  /\ turn = "a"
  /\ spent = 0
  /\ spent' = Whole
  /\ hold' = 0
  /\ turn' = "none"
  /\ UNCHANGED <<week, outside>>

SettleAgain ==
  /\ turn = "none"
  /\ UNCHANGED vars

SettleOther ==
  UNCHANGED vars

SettleSearch ==
  /\ turn = "a"
  /\ hold = SearchHold
  /\ spent = 0
  /\ spent' = SearchHold
  /\ hold' = 0
  /\ turn' = "none"
  /\ UNCHANGED <<week, outside>>

SettleUs ==
  /\ turn = "a"
  /\ hold = UsHold
  /\ spent = 0
  /\ spent' = UsHold
  /\ hold' = 0
  /\ turn' = "none"
  /\ UNCHANGED <<week, outside>>

StopHalf ==
  /\ turn = "a"
  /\ spent' = spent + Charge(Half)
  /\ hold' = 0
  /\ turn' = "none"
  /\ UNCHANGED <<week, outside>>

StopAll ==
  /\ turn = "a"
  /\ spent' = spent + Charge(Whole)
  /\ hold' = 0
  /\ turn' = "none"
  /\ UNCHANGED <<week, outside>>

StopAgain ==
  /\ turn = "none"
  /\ UNCHANGED vars

StopOther ==
  UNCHANGED vars

Release ==
  /\ turn = "a"
  /\ hold' = 0
  /\ turn' = "none"
  /\ UNCHANGED <<spent, week, outside>>

ReleaseOther ==
  UNCHANGED vars

ReleaseClosed ==
  /\ turn = "none"
  /\ UNCHANGED vars

Monday ==
  /\ turn = "none"
  /\ week = 0
  /\ spent' = 0
  /\ week' = 1
  /\ UNCHANGED <<hold, turn, outside>>

Outside ==
  /\ outside = 0
  /\ outside' = 1
  /\ UNCHANGED <<spent, hold, turn, week>>

Next ==
  \/ ReserveHalf
  \/ ReserveAll
  \/ ReserveZero
  \/ ReserveHalfRefused
  \/ ReserveAllRefused
  \/ ReserveSearch
  \/ ReserveSearchRefused
  \/ ReserveUs
  \/ ReserveUsRefused
  \/ SettleHalf
  \/ SettleAll
  \/ SettleAgain
  \/ SettleOther
  \/ SettleSearch
  \/ SettleUs
  \/ StopHalf
  \/ StopAll
  \/ StopAgain
  \/ StopOther
  \/ Release
  \/ ReleaseOther
  \/ ReleaseClosed
  \/ Monday
  \/ Outside

Spec == Init /\ [][Next]_vars

StoppedWithinReserve ==
  [][(StopHalf \/ StopAll) => spent' - spent <= hold]_vars

ChargedOnlyWhileOpen ==
  [][turn = "none" => spent' <= spent]_vars

====

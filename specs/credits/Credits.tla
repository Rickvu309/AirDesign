---- MODULE Credits ----
EXTENDS Integers

VARIABLES cents, spent, open, monday, onceA, onceB

vars == <<cents, spent, open, monday, onceA, onceB>>
Half == 1000000000
Full == 2000000000
Price == 500

Init ==
  /\ cents = 1000
  /\ spent = 0
  /\ open = FALSE
  /\ monday = 0
  /\ onceA = FALSE
  /\ onceB = FALSE

TypeOK ==
  /\ cents \in {0, 500, 1000}
  /\ spent \in {0, Half, Full}
  /\ open \in BOOLEAN
  /\ monday \in {0, 1}
  /\ onceA \in BOOLEAN
  /\ onceB \in BOOLEAN

NonnegativeCredits == cents >= 0
OncePerReset == cents = 1000 - Price * ((IF onceA THEN 1 ELSE 0) + (IF onceB THEN 1 ELSE 0))
OpenWithinAllowance == open => spent <= Half

CanReset == ~open /\ spent > 0 /\ cents >= Price

ResetA ==
  IF ~onceA /\ CanReset
  THEN /\ cents' = cents - Price
       /\ spent' = 0
       /\ onceA' = TRUE
       /\ UNCHANGED <<open, monday, onceB>>
  ELSE UNCHANGED vars

ResetB ==
  IF ~onceB /\ CanReset
  THEN /\ cents' = cents - Price
       /\ spent' = 0
       /\ onceB' = TRUE
       /\ UNCHANGED <<open, monday, onceA>>
  ELSE UNCHANGED vars

Reserve ==
  IF ~open /\ spent <= Half
  THEN /\ open' = TRUE
       /\ UNCHANGED <<cents, spent, monday, onceA, onceB>>
  ELSE UNCHANGED vars

Finish ==
  IF open
  THEN /\ spent' = spent + Half
       /\ open' = FALSE
       /\ UNCHANGED <<cents, monday, onceA, onceB>>
  ELSE UNCHANGED vars

Monday ==
  IF monday = 0 /\ ~open
  THEN /\ spent' = 0
       /\ monday' = 1
       /\ UNCHANGED <<cents, open, onceA, onceB>>
  ELSE UNCHANGED vars

Next == ResetA \/ ResetB \/ Reserve \/ Finish \/ Monday
Spec == Init /\ [][Next]_vars

NoChargeWhileOpen == [][open => cents' = cents]_vars
WeeklyResetIsFree == [][monday' /= monday => cents' = cents]_vars
PaidResetKeepsMonday == [][cents' < cents => monday' = monday]_vars
RecordedResetStaysRecorded == [][(onceA => onceA') /\ (onceB => onceB')]_vars
====

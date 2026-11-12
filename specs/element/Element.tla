---- MODULE Element ----
EXTENDS Naturals

VARIABLES added, removed, typed, picture, uploaded, exported
vars == <<added, removed, typed, picture, uploaded, exported>>

Init ==
  /\ added = FALSE /\ removed = FALSE /\ typed = FALSE
  /\ picture = FALSE /\ uploaded = FALSE /\ exported = FALSE

Add == ~added /\ added' = TRUE /\ exported' = FALSE /\ UNCHANGED <<removed, typed, picture, uploaded>>

AddPicture == ~added /\ added' = TRUE /\ picture' = TRUE /\ exported' = FALSE /\ UNCHANGED <<removed, typed, uploaded>>

Type ==
  /\ added /\ ~removed /\ ~typed /\ ~picture
  /\ typed' = TRUE /\ exported' = FALSE
  /\ UNCHANGED <<added, removed, picture, uploaded>>

Remove == added /\ ~removed /\ removed' = TRUE /\ exported' = FALSE /\ UNCHANGED <<added, typed, picture, uploaded>>

Upload == picture /\ ~uploaded /\ uploaded' = TRUE /\ exported' = FALSE /\ UNCHANGED <<added, removed, typed, picture>>

ExportElsewhere ==
  /\ ~exported /\ (picture => uploaded)
  /\ exported' = TRUE
  /\ UNCHANGED <<added, removed, typed, picture, uploaded>>

Next == Add \/ AddPicture \/ Type \/ Remove \/ Upload \/ ExportElsewhere
Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ added \in BOOLEAN /\ removed \in BOOLEAN /\ typed \in BOOLEAN
  /\ picture \in BOOLEAN /\ uploaded \in BOOLEAN /\ exported \in BOOLEAN
RemovedWasAdded == removed => added
TypedWhileShown == typed => added
TypedIsText == typed => ~picture
UploadedWasAdded == uploaded => picture /\ added
ExportHasBytes == exported /\ picture => uploaded
====

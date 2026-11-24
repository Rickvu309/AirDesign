---- MODULE ReadBase ----
EXTENDS Naturals

VARIABLES head, known, other, first, second, aAt, bAt, empty

vars == <<head, known, other, first, second, aAt, bAt, empty>>

Init ==
  /\ head = 1 /\ known = 1 /\ other = FALSE /\ empty = FALSE
  /\ first = "none" /\ second = "none" /\ aAt = 0 /\ bAt = 0

PrepareFirst ==
  /\ first = "none"
  /\ first' = "queued"
  /\ UNCHANGED <<head, known, other, second, aAt, bAt, empty>>

PrepareSecond ==
  /\ first = "queued" /\ second = "none"
  /\ second' = "queued"
  /\ UNCHANGED <<head, known, other, first, aAt, bAt, empty>>

Other ==
  /\ first # "none" /\ ~other
  /\ head' = head + 1 /\ other' = TRUE
  /\ UNCHANGED <<known, first, second, aAt, bAt, empty>>

AcceptFirst ==
  /\ first = "queued" /\ head = 1
  /\ head' = 2 /\ known' = 2 /\ aAt' = 2 /\ first' = "saved"
  /\ UNCHANGED <<other, second, bAt, empty>>

LoseReply ==
  /\ first = "queued" /\ head = 1
  /\ head' = 2 /\ aAt' = 2 /\ first' = "lost"
  /\ UNCHANGED <<known, other, second, bAt, empty>>

Retry ==
  /\ first = "lost"
  /\ first' = "saved" /\ known' = head
  /\ UNCHANGED <<head, other, second, aAt, bAt, empty>>

RefuseFirst ==
  /\ first = "queued" /\ head # 1
  /\ first' = "stale" /\ known' = head
  /\ second' = IF second = "queued" THEN "stale" ELSE second
  /\ UNCHANGED <<head, other, aAt, bAt, empty>>

LoseCAS ==
  /\ first = "queued" /\ head = 1
  /\ head' = 2 /\ known' = 2 /\ other' = TRUE /\ first' = "stale"
  /\ second' = IF second = "queued" THEN "stale" ELSE second
  /\ UNCHANGED <<aAt, bAt, empty>>

AcceptSecond ==
  /\ first = "saved" /\ second = "queued" /\ head = 2
  /\ head' = 3 /\ known' = 3 /\ bAt' = 3 /\ second' = "saved"
  /\ UNCHANGED <<other, first, aAt, empty>>

RefuseSecond ==
  /\ first = "saved" /\ second = "queued" /\ head # 2
  /\ second' = "stale" /\ known' = head
  /\ UNCHANGED <<head, other, first, aAt, bAt, empty>>

CheckEmpty ==
  /\ ~empty
  /\ empty' = TRUE
  /\ UNCHANGED <<head, known, other, first, second, aAt, bAt>>

Next == CheckEmpty \/ PrepareFirst \/ PrepareSecond \/ Other \/ AcceptFirst \/ LoseReply \/ Retry \/
        RefuseFirst \/ LoseCAS \/ AcceptSecond \/ RefuseSecond

Spec == Init /\ [][Next]_vars

ExactBase == (aAt # 0 => aAt = 2) /\ (bAt # 0 => bAt = 3)
Predecessor == (bAt # 0 => aAt = 2) /\ (first = "stale" => second # "queued")
Once == (aAt # 0 <=> first \in {"lost", "saved"}) /\ (bAt # 0 <=> second = "saved")
OneRowPerOnce == head = 1 + (IF aAt = 0 THEN 0 ELSE 1) + (IF bAt = 0 THEN 0 ELSE 1) + (IF other THEN 1 ELSE 0)
====

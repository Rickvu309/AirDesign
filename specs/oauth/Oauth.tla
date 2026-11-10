---- MODULE Oauth ----

VARIABLES code, access, refresh, previous, family, who, deck, called

vars == <<code, access, refresh, previous, family, who, deck, called>>

TypeOK ==
  /\ code \in {"none", "open", "used"}
  /\ access \in {"none", "live", "dead"}
  /\ refresh \in {"none", "r1", "r2", "dead"}
  /\ previous \in {"none", "r1"}
  /\ family \in {"open", "revoked"}
  /\ who \in {"none", "person", "agent"}
  /\ deck \in {"none", "home"}
  /\ called \in {"no", "yes"}

CodeIsSingleUse ==
  /\ (code = "open" => (access = "none" /\ refresh = "none" /\ previous = "none" /\ called = "no"))
  /\ (code = "used" => (access \in {"live", "dead"} /\ refresh \in {"r1", "r2", "dead"}))
  /\ (code = "none" => (access = "none" /\ refresh = "none" /\ previous = "none" /\ called = "no" /\ family = "open"))

RotationKillsPrevious ==
  /\ (previous = "r1" => refresh \in {"r2", "dead"})
  /\ (refresh = "r1" => previous = "none")
  /\ (refresh = "r2" => (previous = "r1" /\ access = "live" /\ family = "open"))
  /\ ((previous = "r1" /\ family = "open") => (refresh = "r2" /\ access = "live"))

RevocationKillsTokens ==
  family = "revoked" => (access \in {"none", "dead"} /\ refresh \in {"none", "dead"})

IdentityIsStored ==
  /\ (who = "none" <=> code = "none")
  /\ (deck = "none" <=> code = "none")
  /\ (deck = "home" => who \in {"person", "agent"})
  /\ (access = "live" => (deck = "home" /\ who \in {"person", "agent"} /\ family = "open"))

Init ==
  /\ code = "none"
  /\ access = "none"
  /\ refresh = "none"
  /\ previous = "none"
  /\ family = "open"
  /\ who = "none"
  /\ deck = "none"
  /\ called = "no"

IssuePerson ==
  /\ code = "none"
  /\ who = "none"
  /\ code' = "open"
  /\ who' = "person"
  /\ deck' = "home"
  /\ UNCHANGED <<access, refresh, previous, family, called>>

IssueAgent ==
  /\ code = "none"
  /\ who = "none"
  /\ code' = "open"
  /\ who' = "agent"
  /\ deck' = "home"
  /\ UNCHANGED <<access, refresh, previous, family, called>>

IssuePersonRefused ==
  /\ (code /= "none" \/ who /= "none")
  /\ UNCHANGED vars

IssueAgentRefused ==
  /\ (code /= "none" \/ who /= "none")
  /\ UNCHANGED vars

UseCode ==
  /\ code = "open"
  /\ family = "open"
  /\ code' = "used"
  /\ access' = "live"
  /\ refresh' = "r1"
  /\ UNCHANGED <<previous, family, who, deck, called>>

UseAgain ==
  /\ code = "used"
  /\ UNCHANGED vars

UseEarly ==
  /\ code = "none"
  /\ UNCHANGED vars

UseRevoked ==
  /\ code = "open"
  /\ family = "revoked"
  /\ UNCHANGED vars

UseOther ==
  UNCHANGED vars

Call ==
  /\ access = "live"
  /\ family = "open"
  /\ called = "no"
  /\ called' = "yes"
  /\ UNCHANGED <<code, access, refresh, previous, family, who, deck>>

CallOther ==
  UNCHANGED vars

CallRefused ==
  /\ (access /= "live" \/ family = "revoked")
  /\ UNCHANGED vars

Rotate ==
  /\ refresh = "r1"
  /\ family = "open"
  /\ previous = "none"
  /\ refresh' = "r2"
  /\ previous' = "r1"
  /\ called' = "no"
  /\ UNCHANGED <<code, access, family, who, deck>>

RotateRefused ==
  /\ (refresh /= "r1" \/ family = "revoked" \/ previous /= "none")
  /\ UNCHANGED vars

Reuse ==
  /\ previous = "r1"
  /\ family = "open"
  /\ family' = "revoked"
  /\ access' = "dead"
  /\ refresh' = "dead"
  /\ UNCHANGED <<code, previous, who, deck, called>>

ReuseRefused ==
  /\ (previous /= "r1" \/ family = "revoked")
  /\ UNCHANGED vars

Revoke ==
  /\ family = "open"
  /\ code /= "none"
  /\ family' = "revoked"
  /\ access' = IF access = "none" THEN "none" ELSE "dead"
  /\ refresh' = IF refresh = "none" THEN "none" ELSE "dead"
  /\ UNCHANGED <<code, previous, who, deck, called>>

RevokeRefused ==
  /\ (family = "revoked" \/ code = "none")
  /\ UNCHANGED vars

Next ==
  \/ IssuePerson
  \/ IssueAgent
  \/ IssuePersonRefused
  \/ IssueAgentRefused
  \/ UseCode
  \/ UseAgain
  \/ UseEarly
  \/ UseRevoked
  \/ UseOther
  \/ Call
  \/ CallOther
  \/ CallRefused
  \/ Rotate
  \/ RotateRefused
  \/ Reuse
  \/ ReuseRefused
  \/ Revoke
  \/ RevokeRefused

Spec == Init /\ [][Next]_vars

====

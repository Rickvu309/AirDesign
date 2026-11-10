---- MODULE Oauth ----
EXTENDS Integers

VARIABLES principal, deck, code, generation, revoked, reused

vars == <<principal, deck, code, generation, revoked, reused>>

Max == 3

TypeOK ==
  /\ principal \in {"person", "agent"}
  /\ deck \in {"home", "other"}
  /\ code \in {"open", "used"}
  /\ generation \in 0..Max
  /\ revoked \in BOOLEAN
  /\ reused \in BOOLEAN

\* A code works once.
CodeWorksOnce == (code = "open") <=> (generation = 0)

\* A rotated refresh token never works again.
RotatedRefreshIsDead == [][generation' >= generation]_vars

\* Reuse of a rotated token revokes the family.
ReuseRevokesFamily == reused => revoked

\* After revocation no call and no rotation is accepted.
AfterRevocation ==
  [][revoked => (revoked' = TRUE /\ UNCHANGED <<principal, deck, code, generation>>)]_vars

\* The identity is the stored one.
IdentityIsStored == [][UNCHANGED principal]_vars

\* A token for one deck does not authorize another.
DeckIsBound == [][UNCHANGED deck]_vars

Init ==
  /\ principal \in {"person", "agent"}
  /\ deck \in {"home", "other"}
  /\ code = "open"
  /\ generation = 0
  /\ revoked = FALSE
  /\ reused = FALSE

ExchangeHome ==
  /\ deck = "home"
  /\ code = "open"
  /\ revoked = FALSE
  /\ code' = "used"
  /\ generation' = 1
  /\ UNCHANGED <<principal, deck, revoked, reused>>

ExchangeHomeRefused ==
  /\ ~(deck = "home" /\ code = "open" /\ revoked = FALSE)
  /\ UNCHANGED vars

ExchangeOther ==
  /\ deck = "other"
  /\ code = "open"
  /\ revoked = FALSE
  /\ code' = "used"
  /\ generation' = 1
  /\ UNCHANGED <<principal, deck, revoked, reused>>

ExchangeOtherRefused ==
  /\ ~(deck = "other" /\ code = "open" /\ revoked = FALSE)
  /\ UNCHANGED vars

CallHome0Refused ==
  UNCHANGED vars

CallOther0Refused ==
  UNCHANGED vars

CallHome1 ==
  /\ revoked = FALSE
  /\ generation = 1
  /\ deck = "home"
  /\ UNCHANGED vars

CallHome1Refused ==
  /\ ~(revoked = FALSE /\ generation = 1 /\ deck = "home")
  /\ UNCHANGED vars

CallHome2 ==
  /\ revoked = FALSE
  /\ generation = 2
  /\ deck = "home"
  /\ UNCHANGED vars

CallHome2Refused ==
  /\ ~(revoked = FALSE /\ generation = 2 /\ deck = "home")
  /\ UNCHANGED vars

CallHome3 ==
  /\ revoked = FALSE
  /\ generation = 3
  /\ deck = "home"
  /\ UNCHANGED vars

CallHome3Refused ==
  /\ ~(revoked = FALSE /\ generation = 3 /\ deck = "home")
  /\ UNCHANGED vars

CallOther1 ==
  /\ revoked = FALSE
  /\ generation = 1
  /\ deck = "other"
  /\ UNCHANGED vars

CallOther1Refused ==
  /\ ~(revoked = FALSE /\ generation = 1 /\ deck = "other")
  /\ UNCHANGED vars

CallOther2 ==
  /\ revoked = FALSE
  /\ generation = 2
  /\ deck = "other"
  /\ UNCHANGED vars

CallOther2Refused ==
  /\ ~(revoked = FALSE /\ generation = 2 /\ deck = "other")
  /\ UNCHANGED vars

CallOther3 ==
  /\ revoked = FALSE
  /\ generation = 3
  /\ deck = "other"
  /\ UNCHANGED vars

CallOther3Refused ==
  /\ ~(revoked = FALSE /\ generation = 3 /\ deck = "other")
  /\ UNCHANGED vars

Rotate0 ==
  UNCHANGED vars

Rotate1 ==
  /\ revoked = FALSE
  /\ generation = 1
  /\ generation' = 2
  /\ UNCHANGED <<principal, deck, code, revoked, reused>>

Rotate1Reuse ==
  /\ revoked = FALSE
  /\ generation > 1
  /\ revoked' = TRUE
  /\ reused' = TRUE
  /\ UNCHANGED <<principal, deck, code, generation>>

Rotate1Refused ==
  /\ ~(revoked = FALSE /\ generation = 1)
  /\ ~(revoked = FALSE /\ generation > 1)
  /\ UNCHANGED vars

Rotate2 ==
  /\ revoked = FALSE
  /\ generation = 2
  /\ generation' = 3
  /\ UNCHANGED <<principal, deck, code, revoked, reused>>

Rotate2Reuse ==
  /\ revoked = FALSE
  /\ generation > 2
  /\ revoked' = TRUE
  /\ reused' = TRUE
  /\ UNCHANGED <<principal, deck, code, generation>>

Rotate2Refused ==
  /\ ~(revoked = FALSE /\ generation = 2)
  /\ ~(revoked = FALSE /\ generation > 2)
  /\ UNCHANGED vars

Rotate3Refused ==
  /\ ~(revoked = FALSE /\ generation = 3)
  /\ UNCHANGED vars

Rotate4 ==
  UNCHANGED vars

Revoke ==
  /\ revoked = FALSE
  /\ revoked' = TRUE
  /\ UNCHANGED <<principal, deck, code, generation, reused>>

RevokeAgain ==
  /\ revoked = TRUE
  /\ UNCHANGED vars

Next ==
  \/ ExchangeHome
  \/ ExchangeHomeRefused
  \/ ExchangeOther
  \/ ExchangeOtherRefused
  \/ CallHome0Refused
  \/ CallOther0Refused
  \/ CallHome1
  \/ CallHome1Refused
  \/ CallHome2
  \/ CallHome2Refused
  \/ CallHome3
  \/ CallHome3Refused
  \/ CallOther1
  \/ CallOther1Refused
  \/ CallOther2
  \/ CallOther2Refused
  \/ CallOther3
  \/ CallOther3Refused
  \/ Rotate0
  \/ Rotate1
  \/ Rotate1Reuse
  \/ Rotate1Refused
  \/ Rotate2
  \/ Rotate2Reuse
  \/ Rotate2Refused
  \/ Rotate3Refused
  \/ Rotate4
  \/ Revoke
  \/ RevokeAgain

Spec == Init /\ [][Next]_vars

====

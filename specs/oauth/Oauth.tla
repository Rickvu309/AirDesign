---- MODULE Oauth ----
EXTENDS Integers

VARIABLES principal, openedAs, code, generation, revoked, reused, exchanges,
          callNamed, callAt, rotateNamed, rotateAt, acceptedAfter, rotates

vars == <<principal, openedAs, code, generation, revoked, reused, exchanges,
          callNamed, callAt, rotateNamed, rotateAt, acceptedAfter, rotates>>

Max == 3

TypeOK ==
  /\ principal \in {"person", "agent"}
  /\ openedAs \in {"person", "agent"}
  /\ code \in {"open", "used"}
  /\ generation \in 0..Max
  /\ revoked \in BOOLEAN
  /\ reused \in BOOLEAN
  /\ exchanges \in 0..2
  /\ callNamed \in -1..Max
  /\ callAt \in -1..Max
  /\ rotateNamed \in -1..Max
  /\ rotateAt \in -1..Max
  /\ acceptedAfter \in BOOLEAN
  /\ rotates \in BOOLEAN

\* A code works once.
CodeWorksOnce == exchanges <= 1

\* A rotated refresh token never works again.
RotatedRefreshIsDead ==
  /\ callNamed = -1 \/ callNamed = callAt
  /\ rotateNamed = -1 \/ rotateNamed = rotateAt

\* Reuse of a rotated token revokes the family.
ReuseRevokesFamily == reused => revoked

\* After revocation no call and no rotation is accepted.
AfterRevocation == acceptedAfter = FALSE

\* The identity is the stored one.
IdentityIsStored == principal = openedAs

\* A grant that keeps its refresh token never moves past generation 1.
KeptRefreshStaysAtOne == rotates = FALSE => generation <= 1

\* Presenting a kept refresh token again is never reuse.
KeptRefreshIsNeverReuse == rotates = FALSE => reused = FALSE

\* Whether a grant rotates is set once, by the exchange that uses its code.
RotatesSetOnce == [][code = "used" => rotates' = rotates]_vars

Init ==
  /\ principal \in {"person", "agent"}
  /\ openedAs = principal
  /\ code = "open"
  /\ generation = 0
  /\ revoked = FALSE
  /\ reused = FALSE
  /\ exchanges = 0
  /\ callNamed = -1
  /\ callAt = -1
  /\ rotateNamed = -1
  /\ rotateAt = -1
  /\ acceptedAfter = FALSE
  /\ rotates = TRUE

kept == <<principal, openedAs, revoked, reused, callNamed, callAt, rotateNamed, rotateAt, acceptedAfter>>

Exchange ==
  /\ code = "open"
  /\ revoked = FALSE
  /\ code' = "used"
  /\ generation' = 1
  /\ exchanges' = exchanges + 1
  /\ rotates' = TRUE
  /\ UNCHANGED kept

ExchangeKept ==
  /\ code = "open"
  /\ revoked = FALSE
  /\ code' = "used"
  /\ generation' = 1
  /\ exchanges' = exchanges + 1
  /\ rotates' = FALSE
  /\ UNCHANGED kept

ExchangeRefused ==
  /\ ~(code = "open" /\ revoked = FALSE)
  /\ UNCHANGED vars

Call0Refused ==
  UNCHANGED vars

callKept == <<principal, openedAs, code, generation, revoked, reused, exchanges, rotateNamed, rotateAt, rotates>>

Call1 ==
  /\ revoked = FALSE
  /\ generation = 1
  /\ callNamed' = 1
  /\ callAt' = generation
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

Call1Refused ==
  /\ ~(revoked = FALSE /\ generation = 1)
  /\ UNCHANGED vars

Call2 ==
  /\ revoked = FALSE
  /\ generation = 2
  /\ callNamed' = 2
  /\ callAt' = generation
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

Call2Refused ==
  /\ ~(revoked = FALSE /\ generation = 2)
  /\ UNCHANGED vars

Call3 ==
  /\ revoked = FALSE
  /\ generation = 3
  /\ callNamed' = 3
  /\ callAt' = generation
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED callKept

Call3Refused ==
  /\ ~(revoked = FALSE /\ generation = 3)
  /\ UNCHANGED vars

Rotate0 ==
  UNCHANGED vars

rotateKept == <<principal, openedAs, code, revoked, reused, exchanges, callNamed, callAt, rotates>>

Rotate1 ==
  /\ revoked = FALSE
  /\ rotates = TRUE
  /\ generation = 1
  /\ generation' = 2
  /\ rotateNamed' = 1
  /\ rotateAt' = generation
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED rotateKept

Rotate1Kept ==
  /\ revoked = FALSE
  /\ rotates = FALSE
  /\ generation = 1
  /\ rotateNamed' = 1
  /\ rotateAt' = generation
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED <<principal, openedAs, code, generation, revoked, reused, exchanges, callNamed, callAt, rotates>>

Rotate1Reuse ==
  /\ revoked = FALSE
  /\ generation > 1
  /\ revoked' = TRUE
  /\ reused' = TRUE
  /\ UNCHANGED <<principal, openedAs, code, generation, exchanges, callNamed, callAt, rotateNamed, rotateAt, acceptedAfter, rotates>>

Rotate1Refused ==
  /\ ~(revoked = FALSE /\ generation = 1)
  /\ ~(revoked = FALSE /\ generation > 1)
  /\ UNCHANGED vars

Rotate2 ==
  /\ revoked = FALSE
  /\ generation = 2
  /\ generation' = 3
  /\ rotateNamed' = 2
  /\ rotateAt' = generation
  /\ acceptedAfter' = (acceptedAfter \/ revoked)
  /\ UNCHANGED rotateKept

Rotate2Reuse ==
  /\ revoked = FALSE
  /\ generation > 2
  /\ revoked' = TRUE
  /\ reused' = TRUE
  /\ UNCHANGED <<principal, openedAs, code, generation, exchanges, callNamed, callAt, rotateNamed, rotateAt, acceptedAfter, rotates>>

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
  /\ UNCHANGED <<principal, openedAs, code, generation, reused, exchanges, callNamed, callAt, rotateNamed, rotateAt, acceptedAfter, rotates>>

RevokeAgain ==
  /\ revoked = TRUE
  /\ UNCHANGED vars

Next ==
  \/ Exchange
  \/ ExchangeKept
  \/ ExchangeRefused
  \/ Call0Refused
  \/ Call1
  \/ Call1Refused
  \/ Call2
  \/ Call2Refused
  \/ Call3
  \/ Call3Refused
  \/ Rotate0
  \/ Rotate1
  \/ Rotate1Kept
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

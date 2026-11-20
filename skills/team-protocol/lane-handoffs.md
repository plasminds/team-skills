# Lane hand-offs

For team-refactor and team-review, which both work on code that exists and split it by lane.

**The fix decides the lane, not the topic.** A fix that changes behavior (a bug, a hole, a swallowed error, a missing test for new or changed behavior, a gap with the request, a slow path) is team-review's. A named, behavior-preserving refactoring is team-refactor's, and so is a characterization test of unchanged behavior (its Step 0). A misleading name a diff introduces is team-review's (a one-click rename); moving or extracting code to fix it is team-refactor's.

**Hunt in your lane, hand off the rest.** Each skill's agents hunt only in its own lane. What they stumble on in the other goes to a list named for the receiver, *For team-review* or *For team-refactor*, with no extra agent:

- **One line each:** `- <file:line> — <what> — <scenario> — <high|med> — pinned by <test | none>`. The scenario says where it bites: for a suspected bug, the input and what goes wrong; for structure, the change it makes hard and how. *Pinned by* names a test that pins the behavior as it is today (a refactor's Step 0 test), or `none`.
- **Only what could become a card.** Leave out a line with no scenario, a `low` one (`counting.md` § *Confidence*), a design question the scope's plan or decision record already answers, and anything the brief lists as *Settled*.
- **Unverified, no decision.** The run that writes a line never verifies or decides it. The record keeps the list, and the receiving skill takes it in from the record: `team-review <refactor record>…` (`team-review` § *Intake*) and `team-refactor <review record>…` (`team-refactor` § *Intake*).

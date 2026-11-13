---
name: team-doubt
description: 'Use when one claim about code, a migration or config that exists is about to be relied on (merged, shipped, run) and costs a lot if wrong ("this is idempotent", "thread-safe", "the migration is reversible", "the fix covers every caller"), or when the user asks "are we sure?" about it, to double-check it, or to prove it wrong. Not for an approach before the code exists: team-debate. Not for reviewing a whole change before merge: team-review.'
---

# team-doubt

One claim, one fresh agent whose job is to break it. The author's own re-check runs inside the context that produced the claim: it finds the first break it can see, fixes it, and stops, with the premise that hid the next one still in place. A fresh agent gets the code and what it must guarantee, never the reasoning, so it does not inherit the premise. (In a debate, the Philosopher does the reverse: it reads every position and attacks the reasoning. Doubt about an approach belongs there.)

No run folder, no page, no record: the answer comes back in chat.

## When

- The user asks "are we sure?", "double-check this", "prove me wrong", "is this really safe?".
- You are about to tell the user something they will act on (merge, ship, migrate, delete, pay) and it rests on what the code does not show: ordering, concurrency, transactions, retries, a limit, the list of callers.

Not when a test run or the compiler settles the claim: run it. Not for a rename, a format or a move. An approach not yet built, or a choice between options, is `team-debate`'s; a whole change before merge is `team-review`'s.

## Seat

| Agent | Type | Model | Tool budget | Receives | Replies |
|-------|------|-------|-------------|----------|---------|
| Doubter | analyst | sonnet | ~15 | the brief (step 2), nothing else | its breaks and a verdict line |

Dispatch it as `team-skills:team-analyst` if the session lists it, else `team-analyst`, else `general-purpose`, with the model. Running as a subagent yourself (no Agent tool): reply with the brief and "needs team-doubt from the main session", instead of doubting in your own context.

## Flow

1. **Claim.** One line: what holds. A second line: what it costs if it does not. More than one claim → one doubter each, in one message.
2. **Brief.** The doubter's prompt is these five parts, in this order:
   - **Task:** "Break this: find the input, state or sequence of events under which the contract fails. Do not assess whether it is good."
   - **Artifact:** the code as it stands, with its paths (the function, the diff, the migration, the config it reads).
   - **Contract:** what must hold, in the user's terms ("the partner receives every event exactly once"), not the mechanism that is supposed to ensure it.
   - **Context:** the facts the code does not show, each with its source (the profile's *Expected load*, the user, `file:line`): who calls it, how often, retries, transactions, data sizes.
   - **Reply:** "For each break: the scenario step by step, the line it fails on, a test or query that shows it. Then one line: `stands`, `broken`, or `stands if <condition>`. Found nothing: list what you tried."
3. **Reconcile.** Check each break against the code: `confirmed` (reproduced, or the line cited), `refuted` (cite what refutes it), `unclear`.
4. **Fix, then doubt the fix.** Fix confirmed breaks; when the user asked only for a check, ask first. A fix is a new claim: a new doubter, on the fixed artifact, with the same contract. Stop at a round with no confirmed break, after three rounds, or when the user says stop.
5. **Answer** in chat: the claim, the verdict, each break with its status, and what is still `unclear`.

Run by `team-plan` on a one-way step: the caller names the claim, the artifact and the contract, and a fix goes to its fresh executor, not to you.

The doubter shows the question is really a choice between options → offer `team-debate`. It turns out to be about the whole change → offer `team-review`.

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "I re-read it and found the bug, no need for a doubter" | Your re-check stops at the first break your context lets you see. The fresh one looks past it. |
| "My fix answers the doubt" | A fix is a new claim. A new doubter checks it. |
| "I'll give the doubter my reasoning to save it time" | Then it checks your reasoning, not the code. The brief carries the contract and facts with a source. |
| "That break doesn't apply here" | Refute it with a citation, or mark it `unclear`. |

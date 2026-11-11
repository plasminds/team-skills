# Counting positions

What the synthesizer, the gate writer and the record writer apply. Every panelist whose card rates confidence applies § *Confidence*. A copy sits in the run folder.

Every question the roles disagree on is settled by their positions after the last round:

1. **A position counts only if it carries checkable evidence**: a `file:line`, a doc, a command's output, a measurement, or a quoted claim from another role that it refutes. The roles share one model and one brief, so a head count alone measures a shared prior, not independent evidence. An uncounted position is still shown, credited, on its card. A position that the human's answer contradicts counts only if its role sat again after that answer. Evidence of what a case would cause does not back the case: a position on a scenario counts only if the scenario's premise has its own evidence (`reachability.md` § *Reachability check*).
2. **Majority**: more than half of the counted positions back one option. The question becomes a **decision**: the majority's option is recommended, the minority's option stays among the options, and its strongest case goes on the minority's option, as its `for` (or as an `against` on the option it opposes), never on the item.
3. **No majority** (1–1, 2–2, 1–1–1, 2–1–1, or nothing counted): the question becomes a **tension**, one side per position, with the synthesizer's suggested side recommended.
4. A question is a decision or a tension, never both. If a tension's outcome would answer a decision, merge the decision into the tension.
5. Put the count in the item's `tags`, counted positions only: `3–1`, or `2–1 (+1 unbacked)`.

## Confidence

**High confidence survives a refutation.** A finding is `high` only if its author traced the actual code path, can name the concrete input, scenario or cost where it bites, and tried to prove it wrong — looked for the guard, the caller, the test or the doc that would refute it — and could not. The card says what was tried. Anything less is `med` at most. A `low` finding never reaches the gate; the caller says where it goes.

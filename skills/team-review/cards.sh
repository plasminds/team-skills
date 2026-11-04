#!/bin/sh
# team-review step 3: keep each high or med card's heading, Scenario and Fix from the seat files, so the
# verifier never sees a card's Evidence or Refutation. Drops low cards. It lives here, not in SKILL.md,
# because skill argument substitution rewrites awk's field variables in a skill's text.
# Usage: sh cards.sh <run folder>   reads <run folder>/seat-*.md, writes <run folder>/cards.md.
# Prints "cards ok: <n>" and exits 0, or "MISMATCH: ..." and exits 1.
# Then appends each seat's "answered:" and "author choice:" lines as ST-<n> blocks under "## Settled lines",
# and prints "settled lines: <m>" when there are any.
R=${1:?usage: sh cards.sh <run folder>}
awk '
FNR == 1 { f = 0; keep = 0 }
/^(```|~~~)/ { f = !f }
!f && /^### [A-Z][A-Z]+-[0-9]/ { if (c != "" && !low) print c "\n"; c = $0; low = 0; keep = 0; next }
!f && /^###? / { keep = 0 }
!f && /^- \*\*[A-Z][a-z]+(:\*\*|\*\*:)/ { sub(/^- \*\*/, "- "); sub(/(:\*\*|\*\*:)/, ":") }
!f && /^- [A-Z][a-z]+:/ { keep = /^- (Scenario|Fix):/ }
!f && /^- Confidence: *`?low/ { low = 1 }
keep { c = c "\n" $0 }
END { if (c != "" && !low) print c }
' "$R"/seat-*.md > "$R/cards.md" || exit 1
h=$(grep -c '^### [A-Z][A-Z]*-[0-9]' "$R/cards.md")
s=$(grep -c '^- Scenario:' "$R/cards.md")
x=$(grep -c '^- Fix:' "$R/cards.md")
# Settled lines: each seat's "answered:" and "author choice:" lines, numbered ST-1… across seat files, for the verifier.
S=$(awk '
FNR == 1 { f = 0; seat = FILENAME; sub(/.*seat-/, "", seat); sub(/\.md$/, "", seat) }
/^(```|~~~)/ { f = !f; next }
!f && /^- / {
  # The label as seats write it: plain, **bold**, `in backticks`, any case. Written back plain.
  l = $0; sub(/\r$/, "", l); sub(/^- /, "", l)
  if (l ~ /^`.*`$/) l = substr(l, 2, length(l) - 2)
  gsub(/\*\*/, "", l)
  lab = tolower(l)
  if (lab ~ /^answered:/) l = "answered:" substr(l, 10)
  else if (lab ~ /^author choice:/) l = "author choice:" substr(l, 15)
  else next
  n++; printf "### ST-%d: %s\n- Seat: %s\n\n", n, l, seat
}
' "$R"/seat-*.md) || exit 1
if [ "$h" != "$s" ] || [ "$h" != "$x" ]; then echo "MISMATCH: $h headings, $s Scenario, $x Fix"; exit 1; fi
echo "cards ok: $h"
if [ -n "$S" ]; then
  if [ -s "$R/cards.md" ]; then printf '\n' >> "$R/cards.md"; fi
  printf '## Settled lines\n\n%s\n' "$S" >> "$R/cards.md"
  echo "settled lines: $(printf '%s\n' "$S" | grep -c '^### ST-')"
fi

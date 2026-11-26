const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { frontmatter } = require('./routing');
const { listMd } = require('./helpers');

const ROOT = path.join(__dirname, '..', '..');
const SKILLS = path.join(ROOT, 'skills');
const FILE = path.join(SKILLS, 'team-lessons', 'SKILL.md');
const read = f => fs.readFileSync(f, 'utf8');
const text = fs.existsSync(FILE) ? read(FILE) : '';

// A `## Name` section, up to the next `## ` heading.
const section = name => {
  const start = text.indexOf(`\n## ${name}\n`);
  assert.ok(start >= 0, `team-lessons/SKILL.md has no ## ${name}`);
  const end = text.indexOf('\n## ', start + 1);
  return text.slice(start, end < 0 ? undefined : end);
};
// A numbered Flow step, from its bold lead-in to the next step.
const step = lead => {
  const flow = section('Flow');
  const start = flow.search(new RegExp(`\\d+\\. \\*\\*${lead}\\.?\\*\\*`));
  assert.ok(start >= 0, `Flow has no step **${lead}**`);
  const next = flow.slice(start + 1).search(/\n\d+\. \*\*/);
  return flow.slice(start, next < 0 ? undefined : start + 1 + next);
};
const has = (s, ...parts) => { for (const p of parts) assert.ok(s.includes(p), `missing: ${p}`); };

test('E4: team-lessons keeps kinds seen in 3+ distinct branches or dates with record and card ids and a rule line', () => {
  const seat = section('Seat');
  assert.match(seat, /\| Analyst \| analyst \| sonnet \| ~\d+ \|/);
  has(seat, '`team-protocol` § *Agent contract*', '`.council/runs/YYYY-MM-DD-lessons/`', 'deleted at the end');
  has(step('Analyst'),
    'confirmed carded findings (not refuted cards, not *Not raised*)',
    'names each defect kind by its mechanism, not by lens',
    'keeps kinds seen in 3+ distinct branches, or 3+ dates when a kind sits on only two branches',
    "derived from the record's `Owner:`, `Intent:`, scope or filename (no branch field exists)",
    'its occurrences as `<record> <card id>` (review) or `<record> Step <n>` (refactor) and one proposed rule line',
    'not by lens, and keeps kinds',
    'Kinds with fewer occurrences are not listed.');
});

test('E5: team-lessons writes nothing when none is picked or the human declines the confirmation, and adds no review-gate card', () => {
  has(step('Report, then picks'), 'No pick, whatever the count, writes nothing', '`Picked none. Nothing written.`',
    'a free-text answer counts as no pick: `Ignored the free-text answer: pick from the list.`');
  has(step('Confirm, then write'), 'Only a yes writes.');
  has(step('Answer'), 'A confirmation answered `Write nothing`: `Nothing written.`', 'No page, no record.');
  has(text, 'no card on any review gate');
  for (const dir of ['team-review', 'team-view']) {
    for (const f of listMd(path.join(SKILLS, dir))) {
      assert.ok(!read(f).includes('team-lessons'), `${path.relative(ROOT, f)} names team-lessons`);
    }
  }
  assert.ok(!read(path.join(SKILLS, 'team-review', 'templates.md')).includes('Kind:'), 'a Kind: field on a finding');
});

test('team-lessons opens its report with Read N records, committed yes|no (yes only when every record is tracked) and skips .exec.md', () => {
  has(step('Scope'), 'the defaults are `.council/reviews/` and `.council/refactors/`, `*.exec.md` excluded in both (exec briefs hold fix or step cards for executors, not findings)',
    'The report opens `Read N records, committed yes|no`',
    '`yes` only when every record read is tracked by git (`git ls-files`), else `no`; a folder outside git is `no`');
  const report = step('Report, then picks');
  assert.ok(report.indexOf('Read') < report.indexOf('AskUserQuestion'), 'the report must come before the question');
  has(report, 'Print the report before any question');
});

test("team-lessons reads refactor records' approved steps, never rejected cards, Leave alone or For team-review lines, and skips their .exec.md", () => {
  const analyst = step('Analyst');
  has(analyst,
    'In a refactor record, only the steps the human approved count',
    "each step's smell named from the record alone: the step's named refactoring and target, the human's decisions block and the Notes, and the finding cards or `Why:` line when the record holds them (a missing `.exec.md` or `Why:` is not a reason to skip a step)",
    'never read an `.exec.md`',
    'Step 0 (the safety net) names no smell and is not an occurrence',
    '*Considered and rejected*, *Leave alone*, *Tensions* sides not picked, *Next run*, *For team-review* lines',
    'An occurrence is written `<record> Step <n>` (a review occurrence stays `<record> <card id>`)',
    'A kind is one mechanism whichever record type it comes from: occurrences from review and refactor records add up');
  has(step('Scope'), '`.council/refactors/`', '`*.exec.md` excluded in both', 'The report opens `Read N records, committed yes|no`', 'counts both types');
  has(frontmatter(FILE).description, 'review and refactor records', 'refactorisations');
});

test('team-lessons says Read 0 records and writes nothing when no record is found', () => {
  has(step('Scope'), '`Read 0 records, committed no. No review or refactor records found in <paths>. Run team-review or team-refactor first, or pass the folder that holds them. Nothing written.`');
});

test('team-lessons does not offer or count a kind marked already', () => {
  has(step('Analyst'), "a kind the project's `CLAUDE.md` or `.claude/rules/` already holds is marked `already in <file>`");
  has(step('Report, then picks'), 'A kind marked `already` is listed after them as `already in <file>`, is not offered and is not counted.',
    '`Read <N> records, committed <yes|no>. No new kind recurs on 3+ branches or dates. Nothing written.`');
});

test('team-lessons splits its kinds evenly over at most 4 questions, offers at most 16 and never asks a one-option question', () => {
  has(step('Report, then picks'),
    'Offer at most 16 kinds, the ones with the most branches',
    '`<k> more kinds not offered: pass a narrower path.`',
    'AskUserQuestion, multi-select, all questions in one call',
    'the kinds split evenly across up to 4 questions with no question of one option (5 gives 3+2, 9 gives 3+3+3, 13 gives 4+3+3+3)',
    'a single kind is one question `Write this rule?` with options `Write it` and `Write nothing`',
    'header `Kinds <a>-<b>`',
    'text `Which kinds become standing rules? Pick any; none writes nothing.`',
    'label `<n> <kind, 5 words at most>`, description `<B> branches · <F> findings. <rule line>`');
});

test('team-lessons asks in chat and ends its turn in a launched session', () => {
  has(step('Report, then picks'), 'A launched session (`team-protocol` § *Handoff*) has no AskUserQuestion',
    '`Which of these kinds become standing rules? Reply with their numbers; none writes nothing.`, and ends its turn');
  has(step('Confirm, then write'), 'in chat in a launched session');
});

test('team-lessons resolves each cited file name to one repo-relative path before showing a paths: glob and gives a kind with an unresolved name no glob, its lines going in review-lessons.md', () => {
  const write = step('Confirm, then write');
  has(write, 'Before the confirmation shows any `paths:` glob, the analyst resolves each cited file name to its repo-relative path',
    "a name it cannot resolve to one path gives no glob: that kind's lines go in `review-lessons.md`, and the confirmation says they load always",
    'a kind citing several top-level folders goes in `review-lessons.md` with the union of their globs',
    'never a bare `**`');
});

test('team-lessons writes .claude/rules/<topic>.md with paths: only after the picks and the confirmation and never touches CLAUDE.md', () => {
  const flow = section('Flow');
  assert.ok(flow.indexOf('**Report, then picks.**') < flow.indexOf('**Confirm, then write.**'), 'picks come before the confirmation');
  const write = step('Confirm, then write');
  has(write, 'After the picks, one confirmation (AskUserQuestion, `Write these rules?`, options `Write` and `Write nothing`',
    'shows each target file, its `paths:` and the exact lines', 'Only a yes writes.', 'The orchestrator writes the files itself.',
    '`.claude/rules/<topic>.md`', 'A new file is exactly:',
    '```\n---\npaths:\n  - "<folder>/**"\n---\n- <rule line>\n```',
    'One bullet per rule, no heading, no record ids (they go stale).', '`CLAUDE.md` is never touched.');
  has(step('Answer'), '`Picked <p> of <N> kinds. Wrote <f> file(s), <r> rule(s).`',
    '`CLAUDE.md untouched. Edit a file by hand to change a rule or a glob.`');
});

test('team-lessons appends only absent lines to an existing rules file and widens its paths:', () => {
  has(step('Confirm, then write'),
    'An existing file gets only the lines it lacks (exact text after trimming; a reworded rule is appended), its `paths:` widened by the globs it lacks',
    'a file with no frontmatter gets no `paths:` block (it loads always; the confirmation says so) and only its missing lines');
  has(step('Answer'), '`  <path>   paths: <globs>   created|appended: <n> lines, <m> globs`');
});

test('team-lessons: the description carries a French term and its Not-for lines', () => {
  const { name, description } = frontmatter(FILE);
  assert.strictEqual(name, 'team-lessons');
  has(description, 'leçons des revues', 'erreurs récurrentes', 'Not for reviewing a change: team-review.', 'Not for one claim: team-doubt.');
  assert.ok(Buffer.byteLength(text) < 20000, `${Buffer.byteLength(text)} bytes`);
});

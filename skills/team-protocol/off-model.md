# Off-model seat

The roles share one model, so their agreement can be a shared prior (see *Counting positions* in `team-protocol`). A seat run on another vendor's model brings a different one. The caller names the seat that can go off-model; this section says how.

- **Consent first.** The profile's *Other Models* lists the CLIs found. A profile with no *Other Models* section predates it: offer `team-scan` before concluding there is no CLI. Run the seat off-model when its *Team Preferences* says `Off-model seat: yes`, or when the user says yes to the offer in your roster line: *"Philosopher on codex? It sends the brief to OpenAI."* With `no`, no CLI, or no user to ask (CI, a loop), stay on-model and say so in one line. Never call an external CLI without one of those yeses.
- **Same inputs as on-model.** Write the role template, its brief and the agent contract to `<run folder>/<agent id>.prompt.md`. Replace the contract's "Write your full output" line with: `Your reply is your output; end it with a "## Summary" section of one line per position.`
- **Read-only, through stdin.** Check the binary first (`<cli> --version`), then pipe the prompt file in and redirect the reply to the run folder. The prompt holds quotes, backticks and `$(...)`, so it never goes into a shell argument:
  ```bash
  codex exec --sandbox read-only -C <repo> - < <run folder>/<id>.prompt.md > <run folder>/<id>.md
  gemini --approval-mode plan -p "" < <run folder>/<id>.prompt.md > <run folder>/<id>.md
  ```
  Flags change between versions: on an error, check `--help`. If it still fails, say so and run the seat on-model.
- **Read only its Summary.** The orchestrator reads that section, not the whole reply.
- **Counted like any other position**, by the same evidence rule. Credit it with its model, e.g. `Philosopher (codex)`, so the human can see where on-model and off-model positions part.

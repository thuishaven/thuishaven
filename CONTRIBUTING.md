# Contributing to Thuishaven

Thuishaven is a curated playbook, not an open catalog. Every pattern is opinionated by design: one recommended app, one deploy target, one exposure model. That only works if contributions are held to a clear bar. This document explains that bar and the process.

## What makes a good pattern

A pattern solves a **use case**, not "how to install app X". Good: "Date picker for sharing with friends". Bad: "Rallly installation guide". The app is the recommendation, not the subject.

A pattern must:

- Solve a problem a real self-hoster has, end-to-end — from "I have a server" to "it works and survives a reboot".
- Recommend exactly one app, with `alternatives` documenting what else you considered and why you didn't choose it. "I didn't look at alternatives" is not an accepted answer — the opinionation is the product.
- Give numbered, copy-pasteable steps. No "configure as appropriate".
- Include verification steps, gotchas, and maintenance notes (backups, updates, what breaks over time).
- Be written in English, direct and practical. No marketing language.

## Make it executable, not just readable

A pattern is followed by agents as well as humans. Three optional frontmatter
fields turn prose into a machine-checkable contract — use them wherever the work
is genuinely scriptable, and keep prose for the GUI-bound steps that aren't:

- **`inputs`** — the typed, deployment-specific parameters (domains, SMTP
  creds, generated secrets). Declare each as an ENV-style `name` referenced as
  `${NAME}` in steps and assertions. Mark sensitive ones `secret: true`; give
  ones that should be machine-generated a `generate:` command (e.g.
  `openssl rand -hex 32`). This separates the recipe from the inventory, so the
  env block can be generated rather than fat-fingered.
- **`assertions`** — the executable form of the Verification section. Each has a
  kebab-case `id`, a `description`, and **exactly one** of: a `check` (a shell
  command that exits 0 when the assertion holds, may reference `${INPUT}`s) or
  `manual: true` (for checks only a human can do — GUI/visual). Be honest:
  `manual: true` is the right call for "click Deploy" or "vote from a phone".
- **`tested_against`** — `app_version` + `verified` date (quote it:
  `"2026-06-22"`) + optional `upstream_docs`, so staleness is detectable.

The validator enforces uniqueness of input names and assertion ids, the
check-XOR-manual rule, and that every `${INPUT}` an assertion references is a
declared input. Aim for at least one scriptable assertion per pattern.

## The declaration: you ran it

Every pattern PR — new pattern or substantive change — must include this declaration in the PR description:

> **I have personally run this pattern end-to-end** on a real server, following the steps as written, and it produced a working result.

This is not a formality. The whole value of Thuishaven over a generic LLM answer is that a human verified the recipe. If you wrote the steps from documentation knowledge without running them, say so explicitly — the pattern can still land as `experimental`, but the review will be stricter and the status stays `experimental` until someone validates it.

## Pattern lifecycle: experimental → stable → deprecated

- **`experimental`** — contributed, schema-valid, plausible, but not yet validated end-to-end by a maintainer. Agents and users are told to apply extra scrutiny.
- **`stable`** — a maintainer has personally run the pattern end-to-end at least once and it worked without manual fixes. Only maintainers promote patterns to stable.
- **`deprecated`** — a better pattern exists or the app is no longer a sound recommendation. Deprecated patterns are kept for archive with a pointer to the replacement.

When an app's recommended setup changes in a breaking way, bump `version` in the frontmatter. We keep only the latest version in the repo; Git history is the archive.

## How to submit a pattern

1. Fork the repo and create a branch.
2. Copy the frontmatter structure from an existing pattern in [`patterns/`](patterns/). The core fields are required; `inputs`, `assertions`, and `tested_against` are optional but expected wherever the pattern has scriptable parts. All of it is validated against [`schema/pattern.schema.json`](schema/pattern.schema.json).
3. Name the file `patterns/<id>.md` where `<id>` equals the `id` field (kebab-case).
4. Follow the body structure convention: **Context → Decisions explained → Step-by-step → Verification → Gotchas → Maintenance notes**. Where you declared `inputs`/`assertions`, surface them in the body too — a script that generates the env from the inputs, and a `verify.sh` that runs the scriptable assertions.
5. Set `status: experimental` — all new patterns start there.
6. Validate locally: `npm install && npx tsx scripts/validate-patterns.ts`.
7. Open a PR. The template asks for the run-it-yourself declaration and your reasoning on alternatives.

New categories can be proposed via PR against the schema, with justification.

## How reviews work (maintainer-review model)

Every PR is reviewed by a maintainer before merge — currently that's [@hiddevh](https://github.com/hiddevh). CI catches mechanical errors (schema violations, broken related-pattern references) before a human looks at it; the human review is about judgment: Is the recommendation sound? Are the alternatives fairly considered? Are the steps complete and honest about gotchas?

Expect questions about *why* you chose the app, not just *how* to install it. Recommendation criteria we apply:

- Actively maintained, with an official self-host distribution (image or compose file).
- Self-host-respecting: no phone-home requirements, no artificial feature gating that makes self-hosting second-class.
- Sane defaults; complexity proportional to the problem.
- A genuinely better fit for the use case than the alternatives — "most popular" is not automatically "recommended".

The maintainer-review model is intentional while the project is small. If sustained, trusted contributors emerge, co-maintainership follows naturally.

## Non-pattern contributions

Fixes to tooling, schema, CI, or docs follow the normal PR flow without the run-it-declaration. Keep commits in [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `docs:`, `chore:`...).

## Ground rules

- MIT licensed; by contributing you license your contribution under MIT.
- No analytics, telemetry, or tracking — in patterns, tooling, or anything else. Patterns should prefer apps that respect this too, and flag it when an app phones home.
- Be kind in reviews and discussions. Opinionated about software, not about people.

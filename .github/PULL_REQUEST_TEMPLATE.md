# Pull request

## What does this PR do?

<!-- One or two sentences. For a new pattern: what use case does it solve? -->

## Type of change

- [ ] New pattern
- [ ] Change to an existing pattern
- [ ] Tooling / schema / CI
- [ ] Docs

## For pattern PRs (new or changed)

### Declaration

- [ ] **I have personally run this pattern end-to-end** on a real server, following the steps as written, and it produced a working result.
- [ ] I have NOT run it end-to-end — explain below why it should still be considered:

<!-- If not run end-to-end, explain here. The pattern will stay `experimental`. -->

### Alternatives

- [ ] I have considered alternatives and documented in the frontmatter why I chose this app.

<!-- Briefly: what else did you look at, and what tipped the decision? -->

### Checklist

- [ ] `status` is `experimental` (new patterns always start experimental)
- [ ] Filename matches the frontmatter `id`
- [ ] Body follows the convention: Context → Decisions explained → Step-by-step → Verification → Gotchas → Maintenance notes
- [ ] Declared `inputs` for deployment-specific values, with `secret:`/`generate:` set where relevant (or N/A — explain why)
- [ ] Declared `assertions` with at least one scriptable `check`; GUI/visual checks marked `manual: true` (or N/A — explain why)
- [ ] Set `tested_against` (app version + verified date, date quoted)
- [ ] `npx tsx scripts/validate-patterns.ts` passes locally

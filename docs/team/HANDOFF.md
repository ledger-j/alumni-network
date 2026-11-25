# Handoff log (append-only, newest first)

Format: `## YYYY-MM-DD - who - branch/PR` then What changed / Unverified / Needs a human.

## 2026-11-24 - Claude (Sonnet 5.5) - claude/uc-github-hardening
- Changed: CI (`ci.yml`, `tools/ci-static.mjs`, `tools/ci-app-gate.mjs`, `tools/ci-handoff.mjs`), CODEOWNERS for sensitive paths, PR/issue templates, Dependabot, `@claude` workflow, CLAUDE.md/AGENTS.md, this log, CONTRIBUTING rewrite, `static.yml` (Pages) removed, backup tags pruned after 90 days.
- Unverified: first real run of `ci / app-gate` and `ci / backend-gates` happens on this PR; `claude.yml` needs `ANTHROPIC_API_KEY`.
- Needs Jean: make the repo private, unpublish Pages, add `ANTHROPIC_API_KEY` + spend limit, approve the `uc-next` ruleset, review this PR (touches `.github/`).

## 2026-11-24 - Claude - claude/uc-profiles-points (PR #12)
- Changed: round 2 (logo platform-wide, profiles with accent/cover, points, collab requests, map location, events, group chats, mentoring docs) with 12 executed backend gates.
- Unverified: production schema/hooks not applied; live site not diffed after the 24 Nov deploy.
- Needs Jean: production schema run on the LMS box; drift check and repair of the live site before any further deploy.

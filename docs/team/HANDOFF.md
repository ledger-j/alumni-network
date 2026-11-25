# Handoff log (append-only, newest first)

Format: `## YYYY-MM-DD - who - branch/PR` then What changed / Unverified / Needs a human.

## 2026-11-25 - Claude (Builder A) - claude/lane-a-tester
- Changed: hidden tester entrance `#enter/<key>` (js/uc-enter.js + backend/pb_hooks/uc_tester.pb.js, `POST /api/uc/tester/enter`), public sign-up closed (users createRule = null, OAuth2 cannot create accounts), new server-owned `users.tester`, sign-in links removed from public pages (members use hidden `#signin`), guest nav goes to the waitlist, tester banner, backend/tester_admin.py (--list / --purge [--yes] / --reset-limits), backend/verify_tester.py. vt_common.Users.make and verify.py now create members with the superuser token; verify_mentorships asserts anonymous signup is refused.
- Unverified: OAuth2 refusal hook (no provider configured locally); `?v=` bumps and sw.js SHELL entry for js/uc-enter.js left for the release (shared lines with other lanes).
- Needs Jean: set `UC_TESTER_KEY` (32+ random chars) in the PocketBase container env, run init_schema.py on production, share the link `https://unicircle.eu/#enter/<key>`; optional: add a throwaway UC_TESTER_KEY to ci.yml backend-gates so the full tester path runs in CI.

## 2026-11-24 - Claude (Sonnet 5.5) - claude/uc-github-hardening
- Changed: CI (`ci.yml`, `tools/ci-static.mjs`, `tools/ci-app-gate.mjs`, `tools/ci-handoff.mjs`), CODEOWNERS for sensitive paths, PR/issue templates, Dependabot, `@claude` workflow, CLAUDE.md/AGENTS.md, this log, CONTRIBUTING rewrite, `static.yml` (Pages) removed, backup tags pruned after 90 days.
- Unverified: first real run of `ci / app-gate` and `ci / backend-gates` happens on this PR; `claude.yml` needs `ANTHROPIC_API_KEY`.
- Needs Jean: make the repo private, unpublish Pages, add `ANTHROPIC_API_KEY` + spend limit, approve the `uc-next` ruleset, review this PR (touches `.github/`).

## 2026-11-24 - Claude - claude/uc-profiles-points (PR #12)
- Changed: round 2 (logo platform-wide, profiles with accent/cover, points, collab requests, map location, events, group chats, mentoring docs) with 12 executed backend gates.
- Unverified: production schema/hooks not applied; live site not diffed after the 24 Nov deploy.
- Needs Jean: production schema run on the LMS box; drift check and repair of the live site before any further deploy.

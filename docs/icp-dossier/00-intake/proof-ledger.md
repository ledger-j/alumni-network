# UniCircle: Proof Ledger (Step 1, intake)

Seller: **UniCircle** (a Beyond Borders Marketing Consultancy project): a lifelong alumni network where alumni, students and the university's alumni office meet; mentoring and tutoring are its core, the map and live chat its connective tissue.
Status tags: `public` · `verified-in-session` · `seller-claim` · `confidential`. Nothing here is a claim about a prospect.

| ID | Proof point | What was done | Stage | Evidence |
|---|---|---|---|---|
| P1 | UM School of Business and Economics (SBE) alumni office intake | Working sessions with the alumni-office manager and the premium/revenue lead. Their stated situation: ~50k+ alumni, ~4,200 students, alumni budget flat for 5-7 years, 0.5 FTE for building the database, "database" today = the manager's own LinkedIn network, board rejected an external-relations proposal, wish for 1 FTE marketer (e.g. ~3,000 alumni around Munich), portal where alumni find each other by sector and by **tutorial group** ("meet who you studied with"), basic vs premium membership | discovery, no contract | seller-claim (meeting minutes `Context.txt`) |
| P2 | Working platform at unicircle.eu | Magic-link/OTP sign-in, member directory, map, mentoring **and tutoring** requests, live 1:1 chat, installable (PWA), right-hand "orbit" menu; deployed 2026-11-24 | prototype, live | verified-in-session (PR #11, deploy commit 8e9813a) |
| P3 | Waitlist with role split (alumnus / student / university) | Public waitlist, per-page source tags, survey answers stored; 14 rows on 2026-11-08 | pre-launch | seller-claim (internal CRM) |
| P4 | Alumni-office CRM prototype | um-crm.unicircle.eu, synthetic data only, read-only API | prototype | seller-claim |
| P5 | Waitlist CRM in production | crm.unicircle.eu with forced TOTP, deploy-only gate | live (internal) | seller-claim |
| P6 | Privacy model | Map shows city/neighbourhood, never street; directory members-only; rules tested on a real PocketBase (19 chat + 32 mentorship checks) | built | verified-in-session |

Not proven (so never claimed in a dossier): any signed university, any paying member, any usage statistic, any Gemini-verified profile data.

## Open questions for the seller (answer once, then the dossiers are sharper)
1. Is Maastricht UM the *reference* (named) or only an anonymised "a Dutch business school"? (Hard Rule: confidential evidence is not named.)
2. Which Dutch institutions have already been contacted, and by whom (so this week's 10 are new)?
3. Does "10 alumni universities" mean 10 Dutch institutions, or 10 anywhere? Assumption used: **10 Dutch**, ranked, with 3 reserves.
4. Price anchor for the university side (flat fee per year? per active alumnus?), and for premium alumni? Assumption: unknown, dossiers leave it open.

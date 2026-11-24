# Noise log (what was dropped, downgraded or changed, and why)

One line each. Nothing was dropped silently. Applies to lane T: building data.json and the page from the harvest files and fact cards.

## Changed by instruction
- Maastricht SBE (research rank 6, score 22): removed from "contact this week" because the user wants ten alumni offices other than the existing relationship. Kept in data.json (`group: removed`) and shown struck through with the visible note "Maastricht SBE removed from the outreach list: existing relationship". No further detail recorded. Replaced by the first reserve, University of Twente (R1, score 15), which becomes the tenth.

## Downgraded
- Tilburg fact card "alumni pages returned 403; platform UNVERIFIED" was labelled `verified (fetch failure)`. What was verified is the failure, not any fact about Tilburg, so the claim is stored as UNVERIFIED.
- Erasmus (central) "100+ chapter events 2025": the ranking table attaches it to central EUR, but the fact cards state it on the RSM chapters page. Kept as a note on the EUR trigger with attribution marked UNVERIFIED; not shown as an EUR programme.
- WUR 30,000 alumni: derived by the research (22,000 + 8,000 from a snippet, year unclear). Stored as `sourced`, labelled derived.
- Tilburg alumni base: 87,000 (University Fund report, 2022) kept with its year; 90,000 and 60,000 (undated site claims) not used.
- Utrecht lustrum: kept as a trigger without a lustrum number (number UNVERIFIED in the research).
- Nyenrode "80-year mark in 2026": kept only as the research's own inference, stated as such.
- Fact-card confidence for lane B (high / med / low) folded into the four status labels: study, regulator or cited-page claims = `sourced` (no lane-B page was opened in full, so none is `verified`); the lower confidence stays in the claim text for low and low-med items.
- FB023 (SBE size 6,500+ vs 4,200+): conflicting figures, stored UNVERIFIED and not used for sizing.
- FB028 (colour type to behaviour mapping): stored UNVERIFIED, shown only as hypotheses.

## Not carried over
- DISC "German evaluation" (reliability met, validity not met): secondary summary only, primary UNVERIFIED. Dropped from claims; the Wikipedia-based S1 claim stays.
- MBTI 2017 systematic review (7 of 221 studies): secondary search summary, primary UNVERIFIED. Dropped; Pittenger (S2) stays.
- 2026 narrative-gamification meta-analysis (OLJ): one search summary. Mentioned inside the C-blue card as UNVERIFIED, not counted as a claim.
- Radboud JobTeaser career platform: kept as a platform note (jobs, not community); not a score input.
- Cohort and city hub lists for B1-B4: kept as inference inside the cards, never as facts; they are not counted in the claim totals.
- Role-holder names, team members, private details: none collected by the research; none stored.
- Contact data of any kind: not stored. First contact routes are public pages or roles. `node tools/check-icp-privacy.mjs` is part of the self-check.

## Duplicates merged
- Same fact on several pages (Nyenrode alumni page, RSM alumni page): merged into one claim with the best URL.
- Fact cards A and the A research file list the same figures; one claim per figure kept.

## Not built (outside the research)
- No scores for Open Universiteit and AMSIB (research did not score them): listed as unscored with all signals 0 and status UNVERIFIED.
- No peer figures, no market-size numbers, no revenue or willingness-to-pay: not in the research, not added.

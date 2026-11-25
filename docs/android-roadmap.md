# UniCircle Android roadmap

Every number below is an estimate, not a quote.

## Phase 1: Trusted Web Activity (now)
- Scope: PWA manifest, service worker and icons (done on this branch), Bubblewrap wrapper, Play listing.
- Effort (estimate): 6-10 hours (manifest and service worker QA 2 h, Bubblewrap build and signing 2 h, assetlinks and device tests 2 h, store listing and review 2-4 h).
- Cost (estimate): USD 25 one-off Play developer fee, USD 0 extra hosting (same site, same backend).
- Result: an installable app that is always the current website; no second codebase.

## Phase 2: Native Kotlin + Jetpack Compose (later)
- Stack: Compose UI; Ktor client or Retrofit against the same PocketBase REST API; SSE realtime via `/api/realtime`; token auth stored in EncryptedSharedPreferences or DataStore; FCM push; design tokens taken from DESIGN.md (colors, type, spacing) into a Compose theme.
- Build order: 1 auth and token storage, 2 profile, 3 feed, 4 chat (SSE), 5 network, 6 mentor and tutor, 7 map, 8 push, 9 offline cache (Room).

| Screen | Effort in hours (estimate) |
|---|---|
| Foundation (auth, theme, navigation, API layer) | 40-60 |
| Feed | 30-40 |
| Network (directory, filters) | 30-40 |
| Map | 30-50 |
| Mentor and Tutor | 30-40 |
| Chat (SSE, unread, send) | 50-70 |
| Profile | 20-30 |
| Push (FCM plus backend hook) | 20-30 |
| Release, QA, store | 30-40 |
| **Total** | **about 280-400** |

Cost (estimate): at an assumed EUR 60/h contractor rate, EUR 17k-24k. In-house time costs less cash but the same hours.

## When the TWA stops being enough
- Push depth: per-conversation channels, badges or rich actions are needed beyond web push.
- Offline: users must read and compose without a connection, beyond the cached shell.
- Store rating: reviews cite a web-like feel, or Play policy asks for more than a wrapper.
- Device APIs: contacts, background sync, calendar, biometric lock or share targets beyond what Chrome exposes.
Rule of thumb (judgement, not data): move when two triggers hold at the same time.

## Risks
- Digital Asset Links misconfigured, so the TWA shows a URL bar.
- Play may reject a thin web wrapper; mitigate with a real feature set, listing and privacy policy.
- Lost signing key: use Play App Signing and keep the upload keystore backed up by the human.
- Depends on Chrome on Android; this route gives no iOS app.
- A native app doubles maintenance (web and Android), and the API becomes a contract that must be versioned.
- SSE drops often on mobile networks; needs reconnect and resume logic.

## Cost optimisation
- Reuse the web backend: no new server, no new API.
- One codebase now (Phase 1); build native only after the triggers fire.
- Kotlin Multiplatform only if iOS becomes a requirement; it shares networking and models.
- Free tooling: Bubblewrap, Android Studio, Firebase Cloud Messaging free tier, GitHub Actions free minutes.
- The only fixed cost is the one-off USD 25 Play fee (Apple's yearly fee only if iOS is added).

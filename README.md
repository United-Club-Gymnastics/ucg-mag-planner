# UCG MAG Routine Planner

A web app for planning UCG men's artistic gymnastics routines. Gymnasts and coaches sign in with Google, add athletes, pick each athlete's level, enter their floor, pommel horse, rings, parallel bars and high bar skills and their vault, and get live start values. They can export the official **UCG MAG Start Value Worksheet** for their level, filled in, as a PDF.

**Live site:** https://united-club-gymnastics.github.io/ucg-mag-planner/

Started as a copy of Julia Sharpe's [UCG Infinity SV Sheets](https://github.com/jzsharpe/ucg-infinity-sv) (WAG), which is unchanged.

## Who owns what

| Piece | Where | Who can change it |
| --- | --- | --- |
| Code and hosting | This repo in the [United-Club-Gymnastics](https://github.com/United-Club-Gymnastics) GitHub organization, published by GitHub Pages | Organization owners and members with write access |
| Sign-in and saved routines | Firebase project `ucg-routine-planners`, inside the unitedclubgymnastics.org Google Cloud organization | Everyone in the `google-cloud-admin@unitedclubgymnastics.org` group |
| Rules | UCG MAG Rules breakdown and Rules Policy (2026-2028) | MAG rules team |

Routines are saved in Firestore at `users/{user id}/magAthletes/{athlete}`. Other planners can share the same Firebase project by using their own collection name.

## Scoring rules

These follow the 2026-2028 UCG MAG Rules breakdown, the MAG start value worksheets, and the *MAG Routine Composition Planner* spreadsheet. The code is in [`js/scoring.js`](js/scoring.js) and the vault table in [`js/vaults.js`](js/vaults.js).

| Part | Developmental | Intermediate | Advanced (GymACT) |
| --- | --- | --- | --- |
| Counting skills | Top 6 | Top 8 | Top 8 |
| Skill values | A=0.1, B=0.2 … J=1.0 | same | same |
| Element group I | +0.5 for any group I–IV skill, only 3 groups count (max 1.5) | +0.5 | +0.5 |
| Element groups II–III | (above) | A +0.3, B or higher +0.5 | A/B +0.3, C +0.4, D or higher +0.5 |
| Dismount group (IV) | (above) | A +0.3, B or higher +0.5 | Value of the dismount, max 0.5. Floor (no dismount group): as groups II–III |
| Short routine | −0.5 per skill under 6 | −1.0 per skill under 6 | −1.0 per skill under 6 |
| SV cap (includes all bonuses) | 12.3 | 13.1 | None |
| Stuck dismount (not pommel horse) | +0.1 | +0.1 | +0.1 for a B dismount, +0.2 for C or higher |
| Vault stick | +0.1 | +0.1 non-flipping, +0.2 flipping | +0.2 flipping only |
| Vault values | Value column; flipping vaults banned (score 0) | Value column | Advanced column |

Also for every level: each skill counts once (a later skill with the same name is a repeat), at most 4 counting skills from one element group, rings +0.3 one-time bonus for a C or higher strength skill, floor connection bonuses (D+B/C +0.1, D+D +0.2), and high bar C+C connections +0.1. Developmental pommel horse has the mushroom bonus (max +1.0). Advanced floor requires a double flip and Advanced rings a swing to handstand (−0.3 neutral deduction each if missing); these show as expected deductions and aren't part of the start value, as on the worksheet.

The SV cap is applied before the short routine deduction.

## Worksheet export

The PDFs in [`assets/worksheets/`](assets/worksheets/) are the printouts gymnasts fill in by hand (master copies: `Code of Points/MAG/SV Sheets/` in the UCG Dropbox). They aren't fillable forms, so [`js/pdf.js`](js/pdf.js) writes each answer at a fixed position on the page (`LAYOUTS`). **If a worksheet's layout changes, replace its PDF here and re-measure those positions**, then export a test PDF for each level to check.

## One-time setup: Google sign-in (Firebase)

Already done for `ucg-routine-planners`. For a new project:

1. <https://console.firebase.google.com> → **Add project**, signed in with a `@unitedclubgymnastics.org` account so it lands in the UCG Google Cloud organization (Google Analytics isn't needed).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, then save.
3. **Authentication → Settings → Authorized domains → Add domain**: `united-club-gymnastics.github.io`
4. **Build → Firestore Database → Create database** (production mode).
5. **Firestore → Rules**: paste the contents of [`firestore.rules`](firestore.rules), then **Publish**.
6. **Project settings (gear icon) → General → Your apps → Web (`</>`)**: register an app (Hosting isn't needed) and copy the `firebaseConfig` values into [`js/firebase-config.js`](js/firebase-config.js).

The Firebase web config is safe to publish. The security rules only let each signed-in user read and write their own athletes.

## Develop locally

```bash
npm start      # serves on http://localhost:8080
npm test       # scoring tests (Node 20+)
```

Open <http://localhost:8080/?local> to try the app without signing in; athletes are then saved only in that browser. There's no build step. Pushing to `main` runs the tests and publishes the site with GitHub Pages.

## Design

The look follows the UCG Design System (2026 identity): navy / blue green / light blue palette, condensed all-caps display type, 20px cards, pill inputs, and the official logo files in `assets/` (`ucg-primary.svg`, `ucg-mark.svg`). Brand tokens are at the top of `css/styles.css`.

Fonts: the brand faces are Greed Condensed and Suisse Intl, which are licensed and not included in this public repo. The site uses the design system's approved fallbacks, Saira Condensed (Google Fonts) and Arial/Helvetica.

The site icon is `assets/favicon.svg` (white mark on a dark blue green circle), with PNG copies for older browsers and phone home screens.

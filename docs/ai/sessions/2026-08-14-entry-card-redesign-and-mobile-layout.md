# Entry Card Redesign, Mobile Layout, and Auth/New-Rating Copy (Aug 14, 2026)

## Problem

1. The My Ratings page cards didn't match the user's mockup (`myratingspagecorrect.jpg`): the score display, breakdown pills, and action placement were off from the intended design.
2. On phones the redesigned cards looked broken: the fixed `Gut/Detailed/Diff` label block (~216px) left only ~29px of the ~245px content column for the Seasons/Edit/Delete buttons, so they wrapped into a tall right-aligned stack between the meta and score rows; the four breakdown pills wrapped with "Watch Again" alone on a second line.
3. Login/register pages had no explanation of the app for new visitors.
4. New users had no hint on the Add Rating page about what the Detailed Rating is or when to add it.

## Changes

### 1. Entry card redesign (desktop)
- Analyzed the mockup via OCR (`tesseract.js` in `/tmp/opencode/ocr` + `sharp` preprocessing) since the model can't view images directly.
- `entry-card.tsx`: two-row `Gut/Detailed/Diff` stat block (`w-14` centered columns, `text-xl font-bold tabular-nums`, colored via `scoreTextClass` when `prefs.score_chips`, Diff green/red with `+`/`-`); four breakdown pills (Enjoyment/Impact/Recommend/Watch Again) with muted labels and score-band-colored values; Edit/Delete/Seasons moved into the score-header row (right side); visible note text replaced with a `StickyNote` icon + hover Tooltip in the meta row.
- `entries-client.tsx`: the three `TabsContent` changed from `space-y-3` to `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3` (3-across at ≥1280px to match the mockup's ~1505px view).

### 2. Mobile fixes
- Diagnosed via OCR of `phonemyratingswrong.jpg` (1080×1923 phone screenshot).
- Fix 1 (`43c8d65`): on `<768px`, actions moved into the title row; breakdown became a 2×2 grid (`grid grid-cols-2 md:flex md:flex-wrap`).
- Fix 2 (`f11e085`): mobile actions moved under the poster (Note/Edit/Delete icon row, `md:hidden`); Seasons became an icon-only chevron in the title row; the note icon stays in the meta row on desktop only (`hidden md:flex`). The `actions` JSX was split into `seasonsLabeledButton` / `seasonsIconButton` / `editButton` / `deleteButton` / `noteButton` consts reused across both breakpoints.

### 3. Auth blurb
- New shared component `auth-blurb.tsx`: app name, tagline "Rate by gut. Rank with friends.", one-paragraph description, three feature bullets.
- `login` and `register` pages: split-screen layout (`grid max-w-4xl md:grid-cols-2`) with blurb left, form right; stacks on mobile.

### 4. New Rating page copy
- Added a muted callout between `GutRatingForm` and Save Rating, iterated to the user's preferred wording (hyphen-free): "Trust your gut. Or don't... but here is where you can decide what quick rating you would give this show or movie. This is a way to express your overall impression of an entry. Try not to be rash... but trust your intuition. Hint: there is always the detailed rating. Come back in about a week and break it down by enjoyment, impact, recommend, and watch again."
- Removed the gut-rating tooltip (`GUT_RATING_INFO`, `Info` icon, `TooltipProvider`) from `gut-rating-form.tsx` since the hint now lives directly on the page.

## Files changed

- `src/components/entry-card.tsx`
- `src/app/(dashboard)/entries/entries-client.tsx`
- `src/components/auth-blurb.tsx` (new)
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/components/gut-rating-form.tsx`
- `src/app/(dashboard)/entries/new/page.tsx`

## Notes

- Commits (all pushed): `7af9a98`, `43c8d65`, `f11e085`, `e0daaf0`, `5fbdb50`.
- Mockup jpgs (`myratingspagecorrect.jpg`, `phonemyratingswrong.jpg`, etc.) are intentionally left untracked.
- Lint stayed at the pre-existing 73-error baseline (incl. the unrelated `setSelected`-in-effect on `new/page.tsx` and unescaped quotes in the delete dialog); `npm run build` passes.
- The mobile breakpoint is `md` (768px); `<768px` also covers 2-across tablets since their cards are equally narrow.

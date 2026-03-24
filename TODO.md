# ChordPlay TODO

## 1. Space bar play/stop toggle

When the text input is not focused, pressing Space should toggle play/stop
(same focus-guard pattern already used for arrow key navigation in `App.tsx`).

## 2. Singalong mode

Add a "singalong" toggle. When active:
- Arrow-key chord navigation sustains each chord until the user either:
  - Moves to the next/previous chord (arrow keys), or
  - Presses Stop (or Space, which is analogous to Stop)
- The chord rings continuously instead of playing for the tempo duration and stopping.

## 3. Context-aware enharmonic spelling

`DISPLAY_NAMES` in `NoteCards.tsx` hardcodes all ambiguous pitch classes as flats
(`Ds → E♭`, `Gs → A♭`, `As → B♭`). This is wrong in sharp-key contexts —
e.g. F#7 shows "B♭" when it should show "A#".

Fix: choose sharps vs flats based on the chord root (or key context).
Sharp-root chords (F#, C#, G#, etc.) should display sharp spellings;
flat-root chords (Eb, Ab, Bb, Db, etc.) should display flat spellings.

## 4. Shareable song URLs

Encode the chord sequence (and relevant settings like tuning, voice leading, key)
into the URL so users can share a link with their song pre-loaded.

- On input change, update the URL (e.g. query params or hash fragment) without a page reload.
- On page load, read the URL and hydrate the app state from it.
- Keep the encoding compact (e.g. base64 or URI-encoded chord text).

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

## 3. Roman numeral / Nashville number toggle

Add a toggle that transforms the chord input text between two representations:
- **Standard** — e.g. `D A7 Bm G`
- **Roman numeral** — e.g. `I V7 vi IV`

Key detection:
- Auto-detect the key from the first chord in the sequence.
- Provide a manual key override (dropdown) so the user can correct if needed.

When toggled on, the input text itself is transformed to show Roman numerals.
When toggled off, it reverts to the original letter-name chords.

Conventions:
- Uppercase for major (I, IV, V7)
- Lowercase for minor (ii, iii, vi)
- Diminished: vii°
- Secondary dominants: V7/ii, etc.

## 4. Context-aware enharmonic spelling

`DISPLAY_NAMES` in `NoteCards.tsx` hardcodes all ambiguous pitch classes as flats
(`Ds → E♭`, `Gs → A♭`, `As → B♭`). This is wrong in sharp-key contexts —
e.g. F#7 shows "B♭" when it should show "A#".

Fix: choose sharps vs flats based on the chord root (or key context).
Sharp-root chords (F#, C#, G#, etc.) should display sharp spellings;
flat-root chords (Eb, Ab, Bb, Db, etc.) should display flat spellings.

## 5. Shareable song URLs

Encode the chord sequence (and relevant settings like tuning, voice leading, key)
into the URL so users can share a link with their song pre-loaded.

- On input change, update the URL (e.g. query params or hash fragment) without a page reload.
- On page load, read the URL and hydrate the app state from it.
- Keep the encoding compact (e.g. base64 or URI-encoded chord text).

## 6. Smooth-mode voice gravity & spread control

In smooth (voice-leading) mode, add two forces that keep voicings musically natural:

### Gravity toward middle C
- Voices tend to drift too high or too low over successive chords.
- Add a "gravity" bias that gently pulls the overall voicing toward a center
  point near middle C (configurable), so notes don't wander into extreme
  registers.

### Target spread / openness
- Research typical barbershop chord spread — does a standard SATB voicing
  span ~1.5 octaves? ~2 octaves? Tight close-position (all within 1 octave)
  can sound muddy or cramped depending on register.
- Add a configurable "target spread" parameter (e.g. 1–2.5 octaves) that
  the voice-leading algorithm tries to maintain.
- The algorithm should balance minimal voice movement (smooth leading) with
  keeping the chord within the target spread and near the gravity center.

Open questions:
- What is the average interval spread in real barbershop arrangements?
- Should gravity strength and target spread be user-adjustable sliders?
- How to weight gravity vs. minimal-movement in the cost function?

# 9th Chord Omission Syntax

## Problem

9th chords contain 5 notes (1, 3, 5, 7, 9) but ChordPlay only supports 4-note voicings. Previously, the sole 9th chord (`Dom9`) was hardcoded as a rootless voicing. This was inflexible — users couldn't choose which note to omit, and only dominant 9th chords were supported.

## Approach

Make bare 9th chords invalid (since they need 5 notes). Require an explicit omission suffix (`-1`, `-3`, `-5`, or `-7`) specifying which note to drop. Add dominant, major, and minor 9th chord variants. Add `add9` and `madd9` as aliases for 9th-minus-7th voicings.

## Design

### New ChordType values

Remove `Dom9`. Add 12 new entries to `CHORD_TYPES`:

| ChordType | Input syntax(es) | Intervals |
|-----------|-------------------|-----------|
| `Dom9no1` | `9-1` | `[4, 7, 10, 14]` |
| `Dom9no3` | `9-3` | `[0, 7, 10, 14]` |
| `Dom9no5` | `9-5` | `[0, 4, 10, 14]` |
| `Dom9no7` | `9-7`, `add9` | `[0, 4, 7, 14]` |
| `Maj9no1` | `maj9-1` | `[4, 7, 11, 14]` |
| `Maj9no3` | `maj9-3` | `[0, 7, 11, 14]` |
| `Maj9no5` | `maj9-5` | `[0, 4, 11, 14]` |
| `Maj9no7` | `maj9-7` | `[0, 4, 7, 14]` |
| `Min9no1` | `m9-1` | `[3, 7, 10, 14]` |
| `Min9no3` | `m9-3` | `[0, 7, 10, 14]` |
| `Min9no5` | `m9-5` | `[0, 3, 10, 14]` |
| `Min9no7` | `m9-7`, `madd9` | `[0, 3, 7, 14]` |

Intervals are derived by taking the full 5-note chord and removing the omitted note. Some pairs produce identical intervals (e.g., `Dom9no7` and `Maj9no7` both yield `[0, 4, 7, 14]`) — this is correct since the omitted note was the one that distinguished them.

### Parser changes (`parseQuality` in `parser.ts`)

Remove the `['9', 'Dom9']` entry. Add 14 new entries ordered longest-first:

```
'maj9-1' → Maj9no1    'maj9-3' → Maj9no3    'maj9-5' → Maj9no5    'maj9-7' → Maj9no7
'madd9'  → Min9no7    'add9'   → Dom9no7
'm9-1'   → Min9no1    'm9-3'   → Min9no3    'm9-5'   → Min9no5    'm9-7'   → Min9no7
'9-1'    → Dom9no1    '9-3'    → Dom9no3    '9-5'    → Dom9no5    '9-7'    → Dom9no7
```

Bare `9`, `maj9`, and `m9` return `null` (parse error) since they require 5 notes.

### Roman numeral parser

No changes needed — `romanParser.ts` delegates to `parseQuality()`, so `V9-5`, `ii9-1`, `Imaj9-5` etc. work automatically.

### Syntax reference (`SyntaxReference.tsx`)

Replace the `Dom 9 (rootless)` entry in QUALITIES with a brief description of the 9th chord omission system rather than listing all 12 variants.

### Data file update (`myRomance.txt`)

`A9` becomes `A9-1` (or another valid variant) since bare 9ths are no longer valid.

## Files changed

- `web/src/types.ts` — Update `CHORD_TYPES` array
- `web/src/engine/musicTheory.ts` — Update `INTERVALS` map
- `web/src/engine/parser.ts` — Update `parseQuality` entries
- `web/src/components/SyntaxReference.tsx` — Update QUALITIES display
- `myRomance.txt` — Fix bare 9th chord
- `web/src/engine/parser.test.ts` — Update and add parser tests
- `web/src/engine/musicTheory.test.ts` — Update and add interval tests
- `web/src/engine/romanParser.test.ts` — Update roman numeral 9th chord tests

## Testing

- Bare `A9`, `Cmaj9`, `Cm9` all return parse errors
- Each of the 12 new types parses correctly from letter chord syntax
- `add9` and `madd9` aliases parse to `Dom9no7` and `Min9no7`
- Roman numeral variants (`V9-5`, `ii9-1`) parse correctly
- Bare roman `V9` returns parse error
- All 12 interval sets are correct
- `myRomance.txt` integration test passes with updated content

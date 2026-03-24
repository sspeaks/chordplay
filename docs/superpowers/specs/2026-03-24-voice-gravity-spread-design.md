# Voice Gravity & Spread Control

## Problem

In smooth voice-leading mode, voices drift over successive chord transitions. The greedy pairwise optimization minimizes movement per transition but has no global awareness — over a long progression, the entire voicing can creep into extreme registers (too high or too low). Additionally, voices can collapse into tight clusters or spread too wide, producing muddy or thin textures.

Barbershop quartets typically sing within a ~1.5-octave spread in close-position voicings. The current algorithm has no mechanism to maintain this target spread or pull voices toward a comfortable center.

## Approach

Add two complementary forces to the smooth voice-leading algorithm:

1. **Gravity** — bias voice placement toward a configurable center point, preventing register drift.
2. **Spread control** — penalize voicings whose total range deviates from a target spread.

Both are implemented in TypeScript only (web frontend). The Haskell backend is not modified.

## Algorithm Changes

### Gravity-Biased Placement

Currently, `smoothVoice` places each voice at the nearest octave to the **previous voice's MIDI position**:

```typescript
const placed = perm.map((pc, i) => nearestPitch(pc, prevMidis[i]!));
```

With gravity, the placement target is biased toward the gravity center:

```typescript
const GRAVITY_STRENGTH = 0.3;

const biasedTargets = prevMidis.map(pm =>
  Math.round(pm * (1 - GRAVITY_STRENGTH) + gravityCenter * GRAVITY_STRENGTH)
);
const placed = perm.map((pc, i) => nearestPitch(pc, biasedTargets[i]!));
```

This means 70% of the placement target comes from the previous voice position (preserving smooth movement) and 30% from the gravity center (gently pulling toward center). The constant `GRAVITY_STRENGTH = 0.3` is not user-facing — it provides a subtle correction without overwhelming the smoothness objective.

### Spread Penalty in Cost Function

After placing voices for each permutation, compute a spread penalty:

```typescript
const actualSpread = Math.max(...placedMidis) - Math.min(...placedMidis);
const spreadPenalty = SPREAD_WEIGHT * Math.abs(actualSpread - targetSpread);
```

`SPREAD_WEIGHT` is a tuning constant (initially `2`). A 6-semitone deviation from target spread costs 12 — equivalent to one semitone cluster penalty — keeping cluster avoidance dominant while still guiding spread. The penalty is added to the existing cost:

```typescript
const cost = totalCost + clusterPenalty + spreadPenalty;
```

### Updated `smoothVoice` Signature

The `options` parameter is optional. When omitted, defaults are applied internally:

```typescript
export function smoothVoice(
  mode: SmoothMode,
  prevPitches: Pitch[],
  nextPCs: PitchClass[],
  options?: VoiceLeadingOptions,
): Pitch[]
```

Inside the function:

```typescript
const { gravityCenter = DEFAULT_GRAVITY_CENTER, targetSpread = DEFAULT_TARGET_SPREAD } = options ?? {};
```

This preserves backward compatibility — existing callers (including tests) continue to work without changes, using default gravity/spread values.

### Updated `voiceChordSequence` Signature

```typescript
export function voiceChordSequence(
  mode: SmoothMode | null,
  chords: ChordSymbol[],
  options?: VoiceLeadingOptions,
): Pitch[][]
```

When `mode` is `null` (voice leading off), `options` is ignored. When `options` is omitted, defaults are used. The options are passed through to `smoothVoice` unchanged.

### `VoiceLeadingOptions` Interface

Defined in `types.ts` (alongside other shared types):

```typescript
export interface VoiceLeadingOptions {
  readonly gravityCenter?: number;   // MIDI note number (default: 55 = G3)
  readonly targetSpread?: number;    // semitones (default: 18 = 1.5 octaves)
}
```

Both fields are optional — callers can override one or both.

### Constants

Exported from `voiceLeading.ts` so `App.tsx` can use them for initial state:

```typescript
export const GRAVITY_STRENGTH = 0.3;   // Internal: how strongly gravity biases placement
export const SPREAD_WEIGHT = 2;        // Internal: cost function weight for spread deviation
export const DEFAULT_GRAVITY_CENTER = 55;  // MIDI 55 = G3
export const DEFAULT_TARGET_SPREAD = 18;   // 18 semitones = 1.5 octaves
```

### New Helper: `midiToNoteName`

Add to `musicTheory.ts`:

```typescript
const NOTE_NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

export function midiToNoteName(midi: number): string {
  const pc = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}
```

Used by the Toolbar slider display labels.

### Search Space

Unchanged: 24 permutations × O(1) octave lookup per voice. The gravity bias modifies the placement target but doesn't add new candidates.

## Breaking Change: Default Voice Leading Mode

**The default `voiceLeading` state changes from `'off'` to `'smooth'`.** This is an intentional UX change — new users see smooth voice-leading immediately, which better demonstrates the app's capabilities and makes gravity/spread meaningful out of the box.

In `App.tsx`:

```typescript
const [voiceLeading, setVoiceLeading] = useState<VoiceLeading>('smooth');  // was 'off'
```

## UI Changes

### Conditional Sliders

Two range sliders appear inline below the Voice Leading toggle group, visible only when voice leading is `'smooth'` or `'bass'`:

```
Voice Leading: [Off] [Smooth] [Bass-weighted]
  Gravity center: [====●==========] G3
  Target spread:  [===●===========] 1.5 oct
```

When voice leading is `'off'`, the sliders are hidden.

### Gravity Center Slider

- **Range**: MIDI 36–72 (C2–C5)
- **Default**: 55 (G3)
- **Step**: 1 (semitone precision)
- **Display**: Note name (e.g., "G3", "C4", "D3")

### Target Spread Slider

- **Range**: 12–36 semitones (1–3 octaves)
- **Default**: 18 (1.5 octaves)
- **Step**: 1
- **Display**: Formatted as octaves (e.g., "1.5 oct", "2.0 oct")

### New Toolbar Props

```typescript
interface ToolbarProps {
  // ... existing props ...
  gravityCenter: number;
  targetSpread: number;
  onGravityCenterChange: (value: number) => void;
  onTargetSpreadChange: (value: number) => void;
}
```

### Slider Markup

Inline in `Toolbar.tsx`, conditionally rendered:

```tsx
{(voiceLeading === 'smooth' || voiceLeading === 'bass') && (
  <div className="voice-leading-options">
    <label>
      Gravity center
      <input type="range" min={36} max={72} value={gravityCenter}
        onChange={e => onGravityCenterChange(Number(e.target.value))} />
      <span>{midiToNoteName(gravityCenter)}</span>
    </label>
    <label>
      Target spread
      <input type="range" min={12} max={36} value={targetSpread}
        onChange={e => onTargetSpreadChange(Number(e.target.value))} />
      <span>{(targetSpread / 12).toFixed(1)} oct</span>
    </label>
  </div>
)}
```

## File Changes

| File | Change |
|------|--------|
| `web/src/types.ts` | Add `VoiceLeadingOptions` interface |
| `web/src/engine/musicTheory.ts` | Add `midiToNoteName` helper |
| `web/src/engine/voiceLeading.ts` | Add optional `options` parameter to `smoothVoice` and `voiceChordSequence`; implement gravity-biased placement and spread penalty; export `DEFAULT_*` constants |
| `web/src/components/Toolbar.tsx` | Add `gravityCenter`, `targetSpread`, `onGravityCenterChange`, `onTargetSpreadChange` props; render conditional sliders |
| `web/src/App.tsx` | Add `gravityCenter` and `targetSpread` state (using exported defaults); change default `voiceLeading` to `'smooth'`; pass `VoiceLeadingOptions` to `voiceChordSequence`; pass slider props to `Toolbar` |
| `web/src/engine/voiceLeading.test.ts` | Add tests for gravity and spread behavior |
| `web/src/styles/index.css` | Add styles for `.voice-leading-options` slider container |

## Edge Cases

- **Voice leading off**: `options` is ignored; voicings are independent as before.
- **All explicit inversions**: Smooth mode is bypassed per-chord, so gravity/spread have no effect on those chords.
- **Single chord**: No smooth transition occurs; gravity/spread don't apply.
- **First chord placement**: The first chord is always voiced via `voiceChord()` (fixed root-position or explicit inversion), ignoring gravity/spread. If this lands far from `gravityCenter`, the second chord may make a larger-than-usual compensating jump. This is a known limitation — acceptable because gravity's influence is gentle (0.3 strength) and the jump self-corrects by the 3rd chord.
- **Extreme slider values**: Gravity center at C2 with small spread will produce low, tight voicings — this is intentional and user-controllable.
- **Gravity strength at 0.3**: Gentle enough to not override smooth movement, but measurable over 4+ chord transitions.

## Testing

### Unit Tests

1. **Gravity pulls toward center**: Given a voicing far above the gravity center, the next smooth voicing should be closer to center than without gravity. Compare `smoothVoice` with `gravityCenter = 55` vs `gravityCenter = 84` — the resulting centroid should differ.
2. **Spread penalty favors target width**: Given choices between a tight voicing and one matching the target spread, the algorithm prefers the target-width voicing.
3. **Backward compatibility**: Calling `smoothVoice(mode, prev, nextPCs)` without options produces valid 4-note voicings (no regressions in existing tests).
4. **Default options produce valid voicings**: All chords still have 4 notes after adding gravity/spread.
5. **Gravity doesn't break cluster avoidance**: Semitone cluster penalty still functions with gravity enabled.
6. **Gravity + spread tension**: When gravity center is very low (e.g., MIDI 36) and target spread is wide (30), the algorithm still produces a valid 4-note voicing without crashing or producing degenerate results.

### Integration Tests

1. **Long progression stays near center**: A 10+ chord progression with gravity enabled should have its final voicing centroid closer to the gravity center than without gravity (comparative test, not absolute tolerance).
2. **Spread stays within tolerance**: Over a long progression, average voicing spread with `targetSpread = 18` should be closer to 18 than the same progression without spread control (comparative).

import { describe, it, expect } from 'vitest';
import { generateSuggestions, scoreChord, chordSymbolToText, insertChordAfterIndex } from './chordSuggestions';
import { parseChordSequence } from './parser';
import type { ChordSymbol, KeySignature } from '../types';

function chord(root: string, quality: string = 'Major'): ChordSymbol {
  return { root: root as any, quality: quality as any, inversion: null };
}

const C_MAJOR: KeySignature = { root: 'C', quality: 'major' };

describe('scoreChord', () => {
  it('scores circle-of-fifths resolution highest', () => {
    const current = chord('G', 'Dom7');
    const candidate = chord('C');
    const score = scoreChord(current, candidate, C_MAJOR);
    expect(score).toBeGreaterThanOrEqual(35);
  });

  it('scores seventh resolution for chords containing the resolved note', () => {
    const current = chord('G', 'Dom7');
    const cMaj = chord('C');
    const dMin = chord('D', 'Minor');
    const cScore = scoreChord(current, cMaj, C_MAJOR);
    const dScore = scoreChord(current, dMin, C_MAJOR);
    expect(cScore).toBeGreaterThan(dScore);
  });

  it('scores diatonic chords higher than non-diatonic', () => {
    const current = chord('C');
    const diatonic = chord('G');
    const nonDiatonic = chord('Gs');
    const diaScore = scoreChord(current, diatonic, C_MAJOR);
    const nonDiaScore = scoreChord(current, nonDiatonic, C_MAJOR);
    expect(diaScore).toBeGreaterThan(nonDiaScore);
  });

  it('scores secondary dominants', () => {
    const current = chord('C');
    const secDom = chord('A', 'Dom7');
    const plain = chord('A');
    const secScore = scoreChord(current, secDom, C_MAJOR);
    const plainScore = scoreChord(current, plain, C_MAJOR);
    expect(secScore).toBeGreaterThan(plainScore);
  });

  it('scores same-root quality change', () => {
    const current = chord('C');
    const sameRoot = chord('C', 'Dom7');
    const diffRoot = chord('Fs', 'Dom7');
    const sameScore = scoreChord(current, sameRoot, C_MAJOR);
    const diffScore = scoreChord(current, diffRoot, C_MAJOR);
    expect(sameScore).toBeGreaterThan(diffScore);
  });
});

describe('generateSuggestions', () => {
  it('returns 5-10 suggestions', () => {
    const current = chord('G', 'Dom7');
    const suggestions = generateSuggestions(current, C_MAJOR);
    expect(suggestions.length).toBeGreaterThanOrEqual(5);
    expect(suggestions.length).toBeLessThanOrEqual(10);
  });

  it('does not include the current chord', () => {
    const current = chord('G', 'Dom7');
    const suggestions = generateSuggestions(current, C_MAJOR);
    const hasCurrentChord = suggestions.some(
      s => s.chord.root === 'G' && s.chord.quality === 'Dom7'
    );
    expect(hasCurrentChord).toBe(false);
  });

  it('ranks C or Cmaj7 first after G7 in C major', () => {
    const current = chord('G', 'Dom7');
    const suggestions = generateSuggestions(current, C_MAJOR);
    const topRoot = suggestions[0]!.chord.root;
    expect(topRoot).toBe('C');
  });

  it('returns suggestions sorted by score descending', () => {
    const current = chord('C');
    const suggestions = generateSuggestions(current, C_MAJOR);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i]!.score).toBeLessThanOrEqual(suggestions[i - 1]!.score);
    }
  });
});

describe('chordSymbolToText', () => {
  it('converts Major chord', () => {
    expect(chordSymbolToText(chord('C'))).toBe('C');
  });
  it('converts Dom7 chord', () => {
    expect(chordSymbolToText(chord('G', 'Dom7'))).toBe('G7');
  });
  it('converts Min7 chord with sharp root', () => {
    expect(chordSymbolToText(chord('Fs', 'Min7'))).toBe('F#m7');
  });
  it('converts Maj7 chord', () => {
    expect(chordSymbolToText(chord('C', 'Maj7'))).toBe('Cmaj7');
  });
  it('converts Minor chord with flat root', () => {
    expect(chordSymbolToText(chord('As', 'Minor'))).toBe('Bbm');
  });
});

describe('insertChordAfterIndex', () => {
  it('inserts after the first chord', () => {
    const pr = parseChordSequence('C G');
    expect(insertChordAfterIndex('C G', 0, 'Am', pr)).toBe('C Am G');
  });

  it('inserts after the last chord', () => {
    const pr = parseChordSequence('C G');
    expect(insertChordAfterIndex('C G', 1, 'Am', pr)).toBe('C G Am');
  });

  it('handles duplicate chord names by using index', () => {
    const pr = parseChordSequence('C G C');
    expect(insertChordAfterIndex('C G C', 0, 'Dm', pr)).toBe('C Dm G C');
  });

  it('handles duplicate chord names — insert after second instance', () => {
    const pr = parseChordSequence('C G C');
    expect(insertChordAfterIndex('C G C', 2, 'Dm', pr)).toBe('C G C Dm');
  });

  it('preserves multiple spaces', () => {
    const pr = parseChordSequence('C  G');
    expect(insertChordAfterIndex('C  G', 0, 'Am', pr)).toBe('C Am  G');
  });

  it('appends at end when index exceeds valid count', () => {
    const pr = parseChordSequence('C G');
    expect(insertChordAfterIndex('C G', 5, 'Am', pr)).toBe('C G Am');
  });

  it('works with single chord', () => {
    const pr = parseChordSequence('C');
    expect(insertChordAfterIndex('C', 0, 'G7', pr)).toBe('C G7');
  });

  it('skips invalid tokens when counting valid chord indices', () => {
    const pr = parseChordSequence('C xyz G');
    expect(insertChordAfterIndex('C xyz G', 1, 'Am', pr)).toBe('C xyz G Am');
  });

  it('inserts after valid chord even with leading invalid token', () => {
    const pr = parseChordSequence('bad C G');
    expect(insertChordAfterIndex('bad C G', 0, 'Dm', pr)).toBe('bad C Dm G');
  });
});
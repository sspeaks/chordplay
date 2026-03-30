import type { ChordSymbol, ChordType, KeySignature } from '../types';
import { parseChord, tokenizeChordInput } from './parser';
import { parseRomanChord } from './romanParser';
import { pitchClassToInt } from './musicTheory';
import {
  pcToScaleDegree,
  degreeToRomanUpper,
  degreeToRomanLower,
  isSharpKey,
  pcToStandardName,
} from './romanNumerals';

function standardQualitySuffix(quality: ChordType): string {
  const MAP: Record<ChordType, string> = {
    Major: '', Minor: 'm', Dom7: '7', Maj7: 'maj7', Min7: 'm7',
    Dim: 'dim', Dim7: 'dim7', Aug: 'aug', HalfDim7: 'm7b5',
    Sus4: 'sus4', Sus2: 'sus2', MinMaj7: 'mMaj7', Maj6: '6', Min6: 'm6',
    Dom13: '13',
    Dom9no1: '9-1', Dom9no3: '9-3', Dom9no5: '9-5', Dom9no7: '9-7',
    Maj9no1: 'maj9-1', Maj9no3: 'maj9-3', Maj9no5: 'maj9-5', Maj9no7: 'maj9-7',
    Min9no1: 'm9-1', Min9no3: 'm9-3', Min9no5: 'm9-5', Min9no7: 'm9-7',
  };
  return MAP[quality];
}

function romanQualitySuffix(quality: ChordType, isUpper: boolean): string {
  if (quality === 'Major' && isUpper) return '';
  if (quality === 'Minor' && !isUpper) return '';
  return standardQualitySuffix(quality);
}

function isMajorLike(quality: ChordType): boolean {
  return quality === 'Major' || quality === 'Dom7' || quality === 'Maj7'
    || quality === 'Aug' || quality === 'Maj6' || quality === 'Sus4' || quality === 'Sus2'
    || quality === 'Dom13'
    || quality === 'Dom9no1' || quality === 'Dom9no3' || quality === 'Dom9no5' || quality === 'Dom9no7'
    || quality === 'Maj9no1' || quality === 'Maj9no3' || quality === 'Maj9no5' || quality === 'Maj9no7';
}

function detectSecondaryDominant(
  chord: ChordSymbol,
  nextChord: ChordSymbol | null,
  key: KeySignature,
): string | null {
  if (!nextChord) return null;
  if (chord.quality !== 'Dom7' && chord.quality !== 'Major') return null;

  const chordRoot = pitchClassToInt(chord.root);
  const nextRoot = pitchClassToInt(nextChord.root);
  const interval = ((chordRoot - nextRoot) % 12 + 12) % 12;
  if (interval !== 7) return null;

  const { degree: chordDeg, accidental: chordAcc } = pcToScaleDegree(key, chord.root);
  if (chordDeg === 5 && chordAcc === 0) {
    const { degree: nextDeg, accidental: nextAcc } = pcToScaleDegree(key, nextChord.root);
    if (nextDeg === 1 && nextAcc === 0) return null;
  }

  const { degree: targetDeg, accidental: targetAcc } = pcToScaleDegree(key, nextChord.root);
  const targetUpper = isMajorLike(nextChord.quality);
  const targetNumeral = targetUpper
    ? degreeToRomanUpper(targetDeg)
    : degreeToRomanLower(targetDeg);
  const accStr = targetAcc === 1 ? '#' : targetAcc === -1 ? 'b' : '';
  return accStr + targetNumeral;
}

export function chordTextToRoman(text: string, key: KeySignature): string {
  if (text.trim() === '') return text;

  const tokens = tokenizeChordInput(text);
  const chordTokens: { index: number; chord: ChordSymbol }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (/^\s+$/.test(t) || t.startsWith('(')) continue;
    const result = parseChord(t);
    if (result.ok) {
      chordTokens.push({ index: i, chord: result.value });
    }
  }

  return tokens.map((token, i) => {
    if (/^\s+$/.test(token)) return token;
    // Pass through spelled chords unchanged
    if (token.startsWith('(')) return token;

    const result = parseChord(token);
    if (!result.ok) return token;

    const chord = result.value;
    const tokenIdx = chordTokens.findIndex(ct => ct.index === i);
    const nextChord = tokenIdx >= 0 && tokenIdx < chordTokens.length - 1
      ? chordTokens[tokenIdx + 1]!.chord
      : null;

    const secDom = detectSecondaryDominant(chord, nextChord, key);

    const { degree, accidental } = pcToScaleDegree(key, chord.root);
    const upper = isMajorLike(chord.quality);
    const numeral = upper ? degreeToRomanUpper(degree) : degreeToRomanLower(degree);
    const accStr = accidental === 1 ? '#' : accidental === -1 ? 'b' : '';
    const qualSuffix = romanQualitySuffix(chord.quality, upper);

    const invPrefix = chord.inversion !== null ? String(chord.inversion) : '';

    const bassStr = chord.bass !== undefined
      ? '/' + pcToStandardName(chord.bass, isSharpKey(key))
      : '';

    if (secDom) {
      const secQual = chord.quality === 'Dom7' ? '7' : '';
      return `${invPrefix}V${secQual}/${secDom}`;
    }

    return `${invPrefix}${accStr}${numeral}${qualSuffix}${bassStr}`;
  }).join('');
}

export function romanTextToStandard(text: string, key: KeySignature): string {
  if (text.trim() === '') return text;

  const useSharps = isSharpKey(key);
  const tokens = tokenizeChordInput(text);

  return tokens.map(token => {
    if (/^\s+$/.test(token)) return token;
    // Pass through spelled chords unchanged
    if (token.startsWith('(')) return token;

    const result = parseRomanChord(token, key);
    if (!result.ok) return token;

    const chord = result.value;
    const rootName = pcToStandardName(chord.root, useSharps);
    const qualSuffix = standardQualitySuffix(chord.quality);
    const invPrefix = chord.inversion !== null ? String(chord.inversion) : '';

    const bassStr = chord.bass !== undefined
      ? '/' + pcToStandardName(chord.bass, useSharps)
      : '';

    return `${invPrefix}${rootName}${qualSuffix}${bassStr}`;
  }).join('');
}
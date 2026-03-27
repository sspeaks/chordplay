import { deflateSync, inflateSync } from 'fflate';
import type { Tuning, VoiceLeading, PlayStyle, NotationMode, KeySignature } from '../types';

export interface AppState {
  chordText: string;
  tuning: Tuning;
  voiceLeading: VoiceLeading;
  playStyle: PlayStyle;
  tempo: number;
  notationMode: NotationMode;
  selectedKey: KeySignature;
  gravityCenter: number;
  targetSpread: number;
}

export const DEFAULTS: AppState = {
  chordText: '',
  tuning: 'equal',
  voiceLeading: 'smooth',
  playStyle: 'block',
  tempo: 0.8,
  notationMode: 'standard',
  selectedKey: { root: 'C', quality: 'major' },
  gravityCenter: 57,  // A3
  targetSpread: 12,
};

type UrlKeys = { c?: string; t?: string; v?: string; s?: string; p?: number; n?: string; k?: string; g?: number; d?: number };

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeKey(key: KeySignature): string {
  return key.quality === 'minor' ? key.root + 'm' : key.root;
}

function decodeKey(s: string): KeySignature {
  if (s.endsWith('m')) return { root: s.slice(0, -1) as any, quality: 'minor' };
  return { root: s as any, quality: 'major' };
}

export function encodeUrlState(state: AppState): string {
  const d: UrlKeys = {};
  if (state.chordText !== DEFAULTS.chordText) d.c = state.chordText;
  if (state.tuning !== DEFAULTS.tuning) d.t = state.tuning;
  if (state.voiceLeading !== DEFAULTS.voiceLeading) d.v = state.voiceLeading;
  if (state.playStyle !== DEFAULTS.playStyle) d.s = state.playStyle;
  if (state.tempo !== DEFAULTS.tempo) d.p = state.tempo;
  if (state.notationMode !== DEFAULTS.notationMode) d.n = state.notationMode;
  if (state.selectedKey.root !== DEFAULTS.selectedKey.root ||
      state.selectedKey.quality !== DEFAULTS.selectedKey.quality) d.k = encodeKey(state.selectedKey);
  if (state.gravityCenter !== DEFAULTS.gravityCenter) d.g = state.gravityCenter;
  if (state.targetSpread !== DEFAULTS.targetSpread) d.d = state.targetSpread;

  if (Object.keys(d).length === 0) return '';
  const json = JSON.stringify(d);
  const compressed = deflateSync(new TextEncoder().encode(json));
  return toBase64Url(compressed);
}

export function decodeUrlState(hash: string): Partial<AppState> {
  if (!hash || hash === '#') return {};
  try {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!raw) return {};
    const bytes = fromBase64Url(raw);
    const json = new TextDecoder().decode(inflateSync(bytes));
    const d: UrlKeys = JSON.parse(json);
    const result: Partial<AppState> = {};
    if (d.c !== undefined) result.chordText = d.c;
    if (d.t !== undefined) result.tuning = d.t as Tuning;
    if (d.v !== undefined) result.voiceLeading = d.v as VoiceLeading;
    if (d.s !== undefined) result.playStyle = d.s as PlayStyle;
    if (d.p !== undefined) result.tempo = d.p;
    if (d.n !== undefined) result.notationMode = d.n as NotationMode;
    if (d.k !== undefined) result.selectedKey = decodeKey(d.k);
    if (d.g !== undefined) result.gravityCenter = d.g;
    if (d.d !== undefined) result.targetSpread = d.d;
    return result;
  } catch {
    console.warn('ChordPlay: invalid URL state, using defaults');
    return {};
  }
}

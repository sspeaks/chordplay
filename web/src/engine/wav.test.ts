import { describe, it, expect } from 'vitest';
import { encodeWav } from './wav';

// Minimal AudioBuffer polyfill for testing
function makeBuffer(samples: Float32Array, sampleRate = 44100): AudioBuffer {
  return {
    numberOfChannels: 1,
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    getChannelData: (_ch: number) => samples,
  } as unknown as AudioBuffer;
}

function readHeader(blob: Blob): Promise<DataView> {
  return blob.arrayBuffer().then(ab => new DataView(ab));
}

function readString(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

describe('encodeWav', () => {
  it('produces a valid RIFF/WAV header', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = encodeWav(makeBuffer(samples));
    const view = await readHeader(blob);

    expect(readString(view, 0, 4)).toBe('RIFF');
    expect(readString(view, 8, 4)).toBe('WAVE');
    expect(readString(view, 12, 4)).toBe('fmt ');
    expect(readString(view, 36, 4)).toBe('data');

    // fmt sub-chunk size
    expect(view.getUint32(16, true)).toBe(16);
    // PCM format
    expect(view.getUint16(20, true)).toBe(1);
    // 1 channel
    expect(view.getUint16(22, true)).toBe(1);
    // sample rate
    expect(view.getUint32(24, true)).toBe(44100);
    // bits per sample
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('has correct file and data sizes', async () => {
    const numSamples = 100;
    const samples = new Float32Array(numSamples);
    const blob = encodeWav(makeBuffer(samples));
    const view = await readHeader(blob);

    const dataSize = numSamples * 1 * 2; // channels * bytesPerSample
    expect(view.getUint32(40, true)).toBe(dataSize);
    expect(view.getUint32(4, true)).toBe(44 + dataSize - 8);
    expect(blob.size).toBe(44 + dataSize);
  });

  it('converts float samples to correct Int16 values', async () => {
    const samples = new Float32Array([0, 1, -1, 0.5, -0.5]);
    const blob = encodeWav(makeBuffer(samples));
    const view = await readHeader(blob);

    const offset = 44; // header size
    expect(view.getInt16(offset, true)).toBe(0);            // 0
    expect(view.getInt16(offset + 2, true)).toBe(0x7FFF);   // +1 → max positive
    expect(view.getInt16(offset + 4, true)).toBe(-0x8000);  // -1 → max negative
    expect(view.getInt16(offset + 6, true)).toBe(16384);     // 0.5 → ~16384
    expect(view.getInt16(offset + 8, true)).toBe(-16384);    // -0.5 → ~-16384
  });

  it('clamps out-of-range samples', async () => {
    const samples = new Float32Array([2.0, -3.0]);
    const blob = encodeWav(makeBuffer(samples));
    const view = await readHeader(blob);

    expect(view.getInt16(44, true)).toBe(0x7FFF);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });

  it('has correct MIME type', () => {
    const blob = encodeWav(makeBuffer(new Float32Array(10)));
    expect(blob.type).toBe('audio/wav');
  });
});

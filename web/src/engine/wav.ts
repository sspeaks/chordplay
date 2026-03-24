/**
 * Encodes an AudioBuffer as a 16-bit PCM WAV file.
 */
export function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const numFrames = buffer.length;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const out = new ArrayBuffer(fileSize);
  const view = new DataView(out);

  // Interleave channels
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);                              // sub-chunk size
  view.setUint16(20, 1, true);                               // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true);    // block align
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM samples
  let offset = headerSize;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = channels[ch]![i]!;
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0
        ? Math.round(clamped * 0x8000)
        : Math.round(clamped * 0x7FFF);
      view.setInt16(offset, int16, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([out], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

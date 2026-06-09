const PROCESSOR_NAME = 'source-filter-voice';
const MAX_FORMANTS = 8;
const DEFAULT_FORMANT_COUNT = 5;
const TWO_PI = Math.PI * 2;
const PI_OVER_TWO = Math.PI / 2;
const FALLBACK_SAMPLE_RATE = 48000;

const VOWEL_FORMANTS = [
  [
    [730, 1.0, 80],
    [1090, 0.7, 90],
    [2440, 0.5, 120],
    [3300, 0.3, 150],
    [4200, 0.15, 200],
  ],
  [
    [270, 1.0, 60],
    [2290, 0.8, 90],
    [3010, 0.5, 120],
    [3500, 0.3, 150],
    [4500, 0.15, 200],
  ],
  [
    [570, 1.0, 70],
    [840, 0.6, 90],
    [2410, 0.4, 120],
    [3300, 0.25, 150],
    [4200, 0.1, 200],
  ],
  [
    [300, 1.0, 60],
    [870, 0.7, 90],
    [2240, 0.4, 120],
    [3300, 0.25, 150],
    [4200, 0.1, 200],
  ],
];

function clampFinite(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number < min) return min;
  if (number > max) return max;
  return number;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function workletSampleRate() {
  return typeof sampleRate === 'number' && Number.isFinite(sampleRate)
    ? sampleRate
    : FALLBACK_SAMPLE_RATE;
}

class SourceFilterVoiceProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'frequency',
        defaultValue: 220,
        minValue: 40,
        maxValue: 1200,
        automationRate: 'a-rate',
      },
      {
        name: 'gain',
        defaultValue: 0.18,
        minValue: 0,
        maxValue: 1,
        automationRate: 'a-rate',
      },
      {
        name: 'vibratoRate',
        defaultValue: 5.5,
        minValue: 0,
        maxValue: 12,
        automationRate: 'k-rate',
      },
      {
        name: 'vibratoDepth',
        defaultValue: 0.008,
        minValue: 0,
        maxValue: 0.08,
        automationRate: 'k-rate',
      },
      {
        name: 'breath',
        defaultValue: 0.03,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'brightness',
        defaultValue: 0.55,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'jitter',
        defaultValue: 0.002,
        minValue: 0,
        maxValue: 0.03,
        automationRate: 'k-rate',
      },
      {
        name: 'shimmer',
        defaultValue: 0.015,
        minValue: 0,
        maxValue: 0.2,
        automationRate: 'k-rate',
      },
      {
        name: 'vowel',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor() {
    super();
    this.sampleRateHz = workletSampleRate();
    this.phase = 0;
    this.vibratoPhase = 0;
    this.jitterOffset = 0;
    this.shimmerOffset = 0;
    this.seed = 0x1234abcd;
    this.usesCustomFormants = false;
    this.formantCount = DEFAULT_FORMANT_COUNT;
    this.lastVowel = -1;
    this.lastBrightness = -1;

    this.formantFreqs = new Float32Array(MAX_FORMANTS);
    this.formantAmps = new Float32Array(MAX_FORMANTS);
    this.formantBws = new Float32Array(MAX_FORMANTS);
    this.b0 = new Float32Array(MAX_FORMANTS);
    this.b1 = new Float32Array(MAX_FORMANTS);
    this.b2 = new Float32Array(MAX_FORMANTS);
    this.a1 = new Float32Array(MAX_FORMANTS);
    this.a2 = new Float32Array(MAX_FORMANTS);
    this.filterGain = new Float32Array(MAX_FORMANTS);
    this.z1 = new Float32Array(MAX_FORMANTS);
    this.z2 = new Float32Array(MAX_FORMANTS);

    this.setVowelFormants(0, 0.55);

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(message) {
    if (!message || typeof message !== 'object') return;

    const settings =
      message.voiceSettings && typeof message.voiceSettings === 'object'
        ? message.voiceSettings
        : message;

    if (settings.seed !== undefined) {
      this.seed = (clampFinite(settings.seed, 1, 0xffffffff, this.seed) >>> 0) || 1;
    }

    if (
      settings.type === 'resetFormants' ||
      settings.useDefaultFormants === true ||
      settings.formants === null
    ) {
      this.usesCustomFormants = false;
      this.lastVowel = -1;
      this.clearFilterState();
      return;
    }

    if (Array.isArray(settings.formants)) {
      this.setCustomFormants(settings.formants);
    }
  }

  setCustomFormants(formants) {
    let count = 0;

    for (let i = 0; i < formants.length && count < MAX_FORMANTS; i += 1) {
      const item = formants[i];
      if (!item) continue;

      const freq = Array.isArray(item) ? item[0] : item.freq ?? item.frequency;
      const amp = Array.isArray(item) ? item[1] : item.amp ?? item.gain;
      const bw = Array.isArray(item) ? item[2] : item.bw ?? item.bandwidth;
      const sanitizedFreq = clampFinite(freq, 80, this.sampleRateHz * 0.45, NaN);

      if (!Number.isFinite(sanitizedFreq)) continue;

      this.formantFreqs[count] = sanitizedFreq;
      this.formantAmps[count] = clampFinite(amp, 0, 4, 1);
      this.formantBws[count] = clampFinite(bw, 20, 4000, 120);
      count += 1;
    }

    if (count === 0) return;

    this.formantCount = count;
    this.usesCustomFormants = true;
    this.updateCoefficients(Math.max(0, this.lastBrightness));
    this.clearFilterState();
  }

  setVowelFormants(vowel, brightness) {
    const scaled = clampFinite(vowel, 0, 1, 0) * (VOWEL_FORMANTS.length - 1);
    const lowIndex = Math.floor(scaled);
    const highIndex = Math.min(lowIndex + 1, VOWEL_FORMANTS.length - 1);
    const mix = scaled - lowIndex;
    const low = VOWEL_FORMANTS[lowIndex];
    const high = VOWEL_FORMANTS[highIndex];

    this.formantCount = DEFAULT_FORMANT_COUNT;

    for (let i = 0; i < DEFAULT_FORMANT_COUNT; i += 1) {
      this.formantFreqs[i] = lerp(low[i][0], high[i][0], mix);
      this.formantAmps[i] = lerp(low[i][1], high[i][1], mix);
      this.formantBws[i] = lerp(low[i][2], high[i][2], mix);
    }

    this.lastVowel = vowel;
    this.updateCoefficients(brightness);
  }

  updateCoefficients(brightnessValue) {
    const brightness = clampFinite(brightnessValue, 0, 1, 0.55);
    const nyquistSafe = Math.max(1000, this.sampleRateHz * 0.45);

    for (let i = 0; i < this.formantCount; i += 1) {
      const freq = clampFinite(this.formantFreqs[i], 80, nyquistSafe, 700);
      const baseBw = clampFinite(this.formantBws[i], 20, 4000, 120);
      const bw = baseBw * (1.25 - brightness * 0.35);
      const q = clampFinite(freq / bw, 0.25, 60, 8);
      const omega = TWO_PI * freq / this.sampleRateHz;
      const sin = Math.sin(omega);
      const cos = Math.cos(omega);
      const alpha = sin / (2 * q);
      const a0 = 1 + alpha;
      const invA0 = a0 !== 0 ? 1 / a0 : 1;
      const highBand = clampFinite(freq / 4200, 0, 1, 0);
      const highScale = 1 + highBand * (brightness * 1.6 - 0.55);
      const amp = clampFinite(this.formantAmps[i], 0, 4, 1);

      this.b0[i] = alpha * invA0;
      this.b1[i] = 0;
      this.b2[i] = -alpha * invA0;
      this.a1[i] = -2 * cos * invA0;
      this.a2[i] = (1 - alpha) * invA0;
      this.filterGain[i] = amp * Math.max(0.15, highScale);
    }

    this.lastBrightness = brightness;
  }

  clearFilterState() {
    for (let i = 0; i < MAX_FORMANTS; i += 1) {
      this.z1[i] = 0;
      this.z2[i] = 0;
    }
  }

  nextRandomBipolar() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 2147483648 - 1;
  }

  glottalSource(phase, brightness) {
    const bright = clampFinite(brightness, 0, 1, 0.55);
    const openingEnd = 0.34 + (1 - bright) * 0.08;
    const closingEnd = openingEnd + 0.28 + (1 - bright) * 0.08;

    if (phase < openingEnd) {
      const x = phase / openingEnd;
      return 0.8 * Math.sin(Math.PI * x);
    }

    if (phase < closingEnd) {
      const x = (phase - openingEnd) / (closingEnd - openingEnd);
      return -1.15 * Math.sin(PI_OVER_TWO * x);
    }

    return 0;
  }

  process(_inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const blockSize = output[0].length;
    const frequencyParam = parameters.frequency;
    const gainParam = parameters.gain;
    const frequencyIsARate = frequencyParam.length > 1;
    const gainIsARate = gainParam.length > 1;
    const vibratoRate = clampFinite(parameters.vibratoRate[0], 0, 12, 5.5);
    const vibratoDepth = clampFinite(parameters.vibratoDepth[0], 0, 0.08, 0.008);
    const breath = clampFinite(parameters.breath[0], 0, 1, 0.03);
    const brightness = clampFinite(parameters.brightness[0], 0, 1, 0.55);
    const jitter = clampFinite(parameters.jitter[0], 0, 0.03, 0.002);
    const shimmer = clampFinite(parameters.shimmer[0], 0, 0.2, 0.015);
    const vowel = clampFinite(parameters.vowel[0], 0, 1, 0);
    const nyquistPitchLimit = Math.max(80, this.sampleRateHz * 0.45);

    if (this.usesCustomFormants) {
      if (Math.abs(brightness - this.lastBrightness) > 0.002) {
        this.updateCoefficients(brightness);
      }
    } else if (
      Math.abs(vowel - this.lastVowel) > 0.002 ||
      Math.abs(brightness - this.lastBrightness) > 0.002
    ) {
      this.setVowelFormants(vowel, brightness);
    }

    for (let i = 0; i < blockSize; i += 1) {
      const baseFrequency = clampFinite(
        frequencyIsARate ? frequencyParam[i] : frequencyParam[0],
        20,
        nyquistPitchLimit,
        220,
      );
      const gain = clampFinite(gainIsARate ? gainParam[i] : gainParam[0], 0, 1, 0.18);
      const vibrato =
        vibratoRate > 0 && vibratoDepth > 0
          ? Math.sin(this.vibratoPhase) * vibratoDepth
          : 0;
      const cycleFrequency = clampFinite(
        baseFrequency * (1 + vibrato + this.jitterOffset),
        20,
        nyquistPitchLimit,
        baseFrequency,
      );

      this.vibratoPhase += TWO_PI * vibratoRate / this.sampleRateHz;
      if (this.vibratoPhase >= TWO_PI) {
        this.vibratoPhase -= TWO_PI * Math.floor(this.vibratoPhase / TWO_PI);
      }

      this.phase += cycleFrequency / this.sampleRateHz;
      if (this.phase >= 1) {
        this.phase -= Math.floor(this.phase);
        this.jitterOffset = this.nextRandomBipolar() * jitter;
        this.shimmerOffset = this.nextRandomBipolar() * shimmer;
      }

      const voiced = this.glottalSource(this.phase, brightness) * (1 - breath * 0.45);
      const noise = breath > 0.0001 ? this.nextRandomBipolar() * breath * 0.65 : 0;
      const source = voiced + noise;
      let filtered = 0;

      for (let f = 0; f < this.formantCount; f += 1) {
        const y = this.b0[f] * source + this.z1[f];
        this.z1[f] = this.b1[f] * source - this.a1[f] * y + this.z2[f];
        this.z2[f] = this.b2[f] * source - this.a2[f] * y;
        filtered += y * this.filterGain[f];
      }

      const shimmerGain = 1 + this.shimmerOffset;
      const shaped = filtered * shimmerGain * 0.55;
      let sample = gain * (shaped / (1 + Math.abs(shaped)));

      if (!Number.isFinite(sample)) {
        sample = 0;
        this.clearFilterState();
      }

      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel][i] = sample;
      }
    }

    return true;
  }
}

registerProcessor(PROCESSOR_NAME, SourceFilterVoiceProcessor);

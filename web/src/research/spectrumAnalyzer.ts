export class SpectrumAnalyzer {
  private analyser: AnalyserNode;
  private freqCanvas: HTMLCanvasElement;
  private waveCanvas: HTMLCanvasElement;
  private freqCtx: CanvasRenderingContext2D;
  private waveCtx: CanvasRenderingContext2D;
  private freqData: Uint8Array;
  private timeData: Uint8Array;
  private animId: number | null = null;
  private f0: number;

  constructor(
    analyser: AnalyserNode,
    freqCanvas: HTMLCanvasElement,
    waveCanvas: HTMLCanvasElement,
    f0: number,
  ) {
    this.analyser = analyser;
    this.freqCanvas = freqCanvas;
    this.waveCanvas = waveCanvas;
    this.freqCtx = freqCanvas.getContext('2d')!;
    this.waveCtx = waveCanvas.getContext('2d')!;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Uint8Array(analyser.fftSize);
    this.f0 = f0;
  }

  start(): void {
    const draw = () => {
      this.drawSpectrum();
      this.drawWaveform();
      this.animId = requestAnimationFrame(draw);
    };
    draw();
  }

  stop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.clearCanvases();
  }

  setF0(f0: number): void {
    this.f0 = f0;
  }

  private clearCanvases(): void {
    this.freqCtx.fillStyle = '#1a1a2e';
    this.freqCtx.fillRect(0, 0, this.freqCanvas.width, this.freqCanvas.height);
    this.waveCtx.fillStyle = '#1a1a2e';
    this.waveCtx.fillRect(0, 0, this.waveCanvas.width, this.waveCanvas.height);
  }

  private drawSpectrum(): void {
    this.analyser.getByteFrequencyData(this.freqData);
    const ctx = this.freqCtx;
    const w = this.freqCanvas.width;
    const h = this.freqCanvas.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    const sampleRate = this.analyser.context.sampleRate;
    const binCount = this.analyser.frequencyBinCount;
    const maxFreq = 5000;
    const maxBin = Math.min(
      Math.ceil((maxFreq / (sampleRate / 2)) * binCount),
      binCount,
    );

    // Grid lines at 1 kHz intervals
    ctx.strokeStyle = '#262638';
    ctx.lineWidth = 0.5;
    for (let freq = 1000; freq <= 5000; freq += 1000) {
      const x = (freq / maxFreq) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Spectrum curve
    ctx.strokeStyle = '#2a9d8f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < maxBin; i++) {
      const x = (i / maxBin) * w;
      const y = h - (this.freqData[i]! / 255) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Frequency labels
    ctx.fillStyle = '#666';
    ctx.font = '10px JetBrains Mono, monospace';
    for (let freq = 1000; freq <= 5000; freq += 1000) {
      const x = (freq / maxFreq) * w;
      ctx.fillText(`${freq / 1000}k`, x - 8, h - 4);
    }
  }

  private drawWaveform(): void {
    this.analyser.getByteTimeDomainData(this.timeData);
    const ctx = this.waveCtx;
    const w = this.waveCanvas.width;
    const h = this.waveCanvas.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = '#262638';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Show ~2 periods of the waveform based on current f0
    const sampleRate = this.analyser.context.sampleRate;
    const samplesPerPeriod = sampleRate / this.f0;
    const samplesToShow = Math.min(
      Math.ceil(samplesPerPeriod * 2),
      this.timeData.length,
    );

    ctx.strokeStyle = '#4a6fa5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < samplesToShow; i++) {
      const x = (i / samplesToShow) * w;
      const y = (this.timeData[i]! / 255) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

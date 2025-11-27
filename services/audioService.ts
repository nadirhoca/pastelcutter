class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('AudioContext not supported');
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, slideTo: number | null = null) {
    if (!this.ctx || !this.masterGain) return;
    
    // Resume context if suspended (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playStart() {
    this.playTone(440, 'square', 0.1);
    setTimeout(() => this.playTone(880, 'square', 0.2), 100);
    setTimeout(() => this.playTone(1760, 'square', 0.4), 300);
  }

  playMove() {
    // Very quiet tick
    // this.playTone(100, 'square', 0.05); // Annoying if continuous
  }

  playDraw() {
    this.playTone(200, 'sawtooth', 0.1);
  }

  playClaim() {
    this.playTone(880, 'sine', 0.1);
    setTimeout(() => this.playTone(1100, 'square', 0.1), 100);
    setTimeout(() => this.playTone(1760, 'square', 0.3), 200);
  }

  playDie() {
    this.playTone(400, 'sawtooth', 0.5, 50);
    setTimeout(() => {
       // Noise burst simulation
       if(this.ctx && this.masterGain) {
          const bufferSize = this.ctx.sampleRate * 0.5;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const noiseGain = this.ctx.createGain();
          noiseGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
          noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
          noise.connect(noiseGain);
          noiseGain.connect(this.masterGain);
          noise.start();
       }
    }, 100);
  }

  playWin() {
    [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50].forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'square', 0.2), i * 150);
    });
  }
}

export const audioService = new AudioService();
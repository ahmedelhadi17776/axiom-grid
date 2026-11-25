/**
 * Zero-asset procedural Web Audio API synthesizer for AXIOM // GRID.
 * Maps normalized pitch hints (0..1) onto a D-minor pentatonic scale so
 * array swaps, stack heights, and pathfinding wavefronts sound musical.
 * Safely no-ops in non-browser / Vitest environments.
 */

// D4, F4, G4, A4, C5, D5, F5, G5, A5, C6
const D_MINOR_PENTATONIC_HZ = [
  293.66,
  349.23,
  392.0,
  440.0,
  523.25,
  587.33,
  698.46,
  783.99,
  880.0,
  1046.5,
] as const;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function mapPitchToScaleHz(pitch01: number): number {
  const clamped = clamp01(pitch01);
  const idx = Math.round(clamped * (D_MINOR_PENTATONIC_HZ.length - 1));
  return D_MINOR_PENTATONIC_HZ[idx];
}

interface AmbientNodes {
  oscLow: OscillatorNode;
  oscFifth: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private ambientEnabled = false;
  private ambientNodes: AmbientNodes | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;

    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.45;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        // Ignore autoplay rejection until next user gesture
      });
    }

    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, now, 0.02);
    }
    if (muted) {
      this.stopAmbientNodes();
    } else if (this.ambientEnabled) {
      this.startAmbientNodes();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setAmbientEnabled(enabled: boolean): void {
    this.ambientEnabled = enabled;
    if (enabled && !this.muted) {
      this.startAmbientNodes();
    } else {
      this.stopAmbientNodes();
    }
  }

  public isAmbientEnabled(): boolean {
    return this.ambientEnabled;
  }

  /** Soft filtered sine tick (12ms) for pointer hover */
  public playHover(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.018);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  /** Crisp dual-harmonic UI click */
  public playSelect(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const freqs = [587.33, 880]; // D5 + A5
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.045);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.065);
    }
  }

  /** Rising resonant chime + subtle pitch glide mapped to D-minor pentatonic */
  public playSwap(pitch01 = 0.5): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const baseHz = mapPitchToScaleHz(pitch01);

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseHz, now);
    osc.frequency.exponentialRampToValueAtTime(baseHz * 1.25, now + 0.09);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.17);
  }

  /** Futuristic magnetic tether lock (FM chirp) */
  public playLink(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const outGain = ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(440, now);
    carrier.frequency.exponentialRampToValueAtTime(783.99, now + 0.085);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(160, now);
    modGain.gain.setValueAtTime(140, now);
    modGain.gain.exponentialRampToValueAtTime(10, now + 0.09);

    outGain.gain.setValueAtTime(0.0001, now);
    outGain.gain.linearRampToValueAtTime(0.2, now + 0.008);
    outGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(outGain);
    outGain.connect(this.masterGain);

    mod.start(now);
    carrier.start(now);
    mod.stop(now + 0.14);
    carrier.stop(now + 0.14);
  }

  /** Clean marimba-like ping scaled to node/step metric */
  public playStep(pitch01 = 0.5): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const hz = mapPitchToScaleHz(pitch01);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Low sawtooth buzz + bandpass drop for overflow / leak / null deref */
  public playError(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(82, now + 0.24);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.24);
    filter.Q.value = 2.5;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Shimmering 4-note neon arpeggio (D4 -> A4 -> C5 -> F5) */
  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [293.66, 440.0, 523.25, 698.46]; // D4, A4, C5, F5

    notes.forEach((hz, idx) => {
      const start = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, start);

      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(hz * 2, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);

      osc.connect(gain);
      harmonic.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(start);
      harmonic.start(start);
      osc.stop(start + 0.4);
      harmonic.stop(start + 0.4);
    });
  }

  private startAmbientNodes(): void {
    if (this.ambientNodes) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const oscLow = ctx.createOscillator();
    const oscFifth = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // Warm D2 (73.42 Hz) + A2 (110.00 Hz) drone
    oscLow.type = 'sine';
    oscLow.frequency.setValueAtTime(73.42, now);

    oscFifth.type = 'triangle';
    oscFifth.frequency.setValueAtTime(110.0, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);
    filter.Q.value = 1.2;

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, now);
    lfoGain.gain.setValueAtTime(95, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.8);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    oscLow.connect(filter);
    oscFifth.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    oscLow.start(now);
    oscFifth.start(now);
    lfo.start(now);

    this.ambientNodes = { oscLow, oscFifth, lfo, lfoGain, filter, gain };
  }

  private stopAmbientNodes(): void {
    if (!this.ambientNodes || !this.ctx) return;
    const { oscLow, oscFifth, lfo, gain } = this.ambientNodes;
    const now = this.ctx.currentTime;

    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.08);
      oscLow.stop(now + 0.25);
      oscFifth.stop(now + 0.25);
      lfo.stop(now + 0.25);
    } catch {
      // Already stopped
    }
    this.ambientNodes = null;
  }
}

export const soundEngine = new SoundEngine();

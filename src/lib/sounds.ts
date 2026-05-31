// Synthesized game show sound effects using browser's native Web Audio API
// This works offline, requires zero assets, and adds a premium interactive feel.

class SoundSynth {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private init() {
    if (this.isMuted) return;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play a soft bubble chime when a player joins the lobby
  playJoin() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const context = this.ctx; // Capture reference for callback scope safety
    const now = context.currentTime;
    
    // Low pass filter to make it warmer
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.connect(context.destination);

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);
      
      gain.gain.setValueAtTime(0.15, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.4);
      
      osc.connect(gain);
      gain.connect(filter);
      
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.4);
    });
  }

  // Play a sharp, short woodblock tick for the timer
  playTick(secondsLeft: number) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    // Raise pitch as the timer gets closer to 0 for tension
    const baseFreq = secondsLeft <= 5 ? 800 : 440;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Play a retro game show buzzer when the timer runs out
  playBuzzer() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(130, now); // low, detuned notes
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(135, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  }

  // Play a positive sweep arpeggio when results are revealed
  playReveal() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const context = this.ctx; // Capture reference for callback scope safety
    const now = context.currentTime;

    const notes = [349.23, 440.00, 523.25, 659.25, 783.99, 1046.50]; // F4, A4, C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.06);

      gain.gain.setValueAtTime(0.1, now + index * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.06 + 0.5);

      osc.connect(gain);
      gain.connect(context.destination);

      osc.start(now + index * 0.06);
      osc.stop(now + index * 0.06 + 0.5);
    });
  }

  // Play a triumphant synth fanfare for the victory podium
  playVictory() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const context = this.ctx; // Capture reference for callback scope safety
    const now = context.currentTime;

    const chords = [
      [261.63, 329.63, 392.00], // C major
      [293.66, 349.23, 440.00], // D minor
      [349.23, 440.00, 523.25], // F major
      [392.00, 493.88, 587.33, 783.99], // G major 7 / high G
    ];

    chords.forEach((notes, chordIndex) => {
      const startTime = now + chordIndex * 0.35;
      const duration = chordIndex === chords.length - 1 ? 1.2 : 0.3;

      notes.forEach((freq) => {
        const osc = context.createOscillator();
        const gain = context.createGain();

        // Mix triangle and sine to make a rich synth brass sound
        osc.type = chordIndex % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.08, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(context.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    });
  }

  // Soft digital blip for student submitting answers
  playSubmit() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }
}

export const sounds = new SoundSynth();

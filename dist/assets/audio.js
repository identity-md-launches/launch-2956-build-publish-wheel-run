export class GameAudio {
  enabled = false;
          context                      = null;
  async toggle()                   {
    if (this.enabled) {
      this.enabled = false;
      return false;
    }
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      this.enabled = true;
      this.play("jump");
    } catch {
      this.enabled = false;
    }
    return this.enabled;
  }
  play(kind                                    ) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const tones = {
      jump: [340, 610],
      slide: [230, 150],
      end: [180, 65],
      quake: [90, 40],
    };
    const [from, to] = tones[kind];
    oscillator.type = kind === "quake" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + 0.16);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.07, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(start + 0.23);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}

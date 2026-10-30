import * as Tone from 'tone';
import { BPM, eventsForStep } from './music.js';

export const WAVES = ['sine', 'square', 'sawtooth', 'triangle'];
export const SCENES = ['sleep', 'wake', 'move'];
export const CHARACTERS = ['soft', 'bright', 'sharp'];
export const DRUMS = ['kick', 'snare', 'hat'];

// Yellow cells on the reference screenshot (editable by the performer).
export const INITIAL_RHYTHM = {
  kick:  [false, false, false, false, true,  false, false, true],
  snare: [true,  false, true,  false, false, true,  false, false],
  hat:   [false, false, false, false, false, false, true,  false],
};
export const INITIAL_SETTINGS = [
  { volume: 72, portamento: 7, type: 'square', detune: 50, phase: 0, filter: 68, attack: 15 },
  { volume: 72, portamento: 3, type: 'sine', detune: 50, phase: 0, filter: 55, attack: 8 },
];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Lead: MonoSynth -> Lowpass -> Tremolo -> Delay -> Reverb -> Stereo L -> Master
// Bass: MonoSynth -> Lowpass -> Tremolo -> Delay -> Reverb -> Stereo R -> Master
// Kick/Snare/Hat each go to a third (centered) drum channel -> Master.
// All tones are generated in Tone.js, with no pre-recorded samples or external audio URLs.
export class MorningEngine {
  constructor({ onStep = () => {}, onScene = () => {} } = {}) {
    this.onStep = onStep;
    this.onScene = onScene;
    this.currentStep = 0;
    this.activeScene = 'sleep';
    this.pendingScene = null;
    this.character = 'bright';
    this.effects = { delay: false, reverb: true, tremolo: false };
    this.rhythm = Object.fromEntries(DRUMS.map((name) => [name, [...INITIAL_RHYTHM[name]]]));
    this.settings = INITIAL_SETTINGS.map((settings) => ({ ...settings }));
    this.playing = false;

    this.master = new Tone.Gain(0.72).toDestination();
    this.tracks = [0, 1].map((index) => {
      const synth = new Tone.MonoSynth({
        oscillator: { type: this.settings[index].type, phase: 0 },
        envelope: { attack: 0.025, decay: 0.19, sustain: index === 0 ? 0.43 : 0.6, release: 0.28 },
        filterEnvelope: { attack: 0.01, decay: 0.18, sustain: 0.35, release: 0.3, baseFrequency: index === 0 ? 260 : 110, octaves: 2 },
        portamento: 0,
      });
      const filter = new Tone.Filter({ type: 'lowpass', frequency: 1900, rolloff: -12 });
      const tremolo = new Tone.Tremolo({ frequency: index === 0 ? 5.8 : 3.3, depth: 0.65, wet: 0 }).start();
      const delay = new Tone.FeedbackDelay({ delayTime: index === 0 ? '8n' : '4n', feedback: 0.21, wet: 0 });
      const reverb = new Tone.Reverb({ decay: index === 0 ? 2.1 : 1.35, wet: index === 0 ? 0.17 : 0.09 });
      const channel = new Tone.Channel({ pan: index === 0 ? -0.32 : 0.32, volume: -10 });
      const waveform = new Tone.Waveform(512);
      synth.chain(filter, tremolo, delay, reverb, channel);
      channel.connect(this.master);
      channel.connect(waveform);
      return { synth, filter, tremolo, delay, reverb, channel, waveform };
    });

    this.drumChannel = new Tone.Channel({ volume: -13, pan: 0 }).connect(this.master);
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.045, octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.1 },
    }).connect(this.drumChannel);
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    }).connect(this.drumChannel);
    this.hatFilter = new Tone.Filter({ frequency: 6100, type: 'highpass' }).connect(this.drumChannel);
    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.038, sustain: 0, release: 0.01 },
    }).connect(this.hatFilter);

    Tone.getTransport().bpm.value = BPM;
    this.tracks.forEach((_, index) => Object.entries(this.settings[index]).forEach(([key, value]) => this.setParameter(index, key, value)));
    this.applyCharacter();
    this.applyEffects();
    this.repeatId = Tone.getTransport().scheduleRepeat((time) => this.tick(time), '8n', 0);
  }

  tick(time) {
    // One bar = eight eighth-note steps. Scene changes only on bar boundaries.
    if (this.currentStep % 8 === 0 && this.pendingScene !== null) {
      this.activeScene = this.pendingScene;
      this.pendingScene = null;
      const scene = this.activeScene;
      Tone.getDraw().schedule(() => this.onScene(scene), time);
    }
    const step = this.currentStep % 8;
    const bar = Math.floor(this.currentStep / 8);
    const events = eventsForStep(this.activeScene, bar, step);
    for (const event of events) {
      if (event.voice === 'lead' || event.voice === 'bass') {
        const index = event.voice === 'lead' ? 0 : 1;
        this.tracks[index].synth.triggerAttackRelease(event.note, event.duration, time, event.velocity);
      }
    }
    const sceneVolume = { sleep: 0.35, wake: 0.67, move: 0.92 }[this.activeScene];
    DRUMS.forEach((name) => {
      if (!this.rhythm[name][step]) return;
      if (name === 'kick') this.kick.triggerAttackRelease('C1', '8n', time, 0.80 * sceneVolume);
      if (name === 'snare') this.snare.triggerAttackRelease('16n', time, 0.52 * sceneVolume);
      if (name === 'hat') this.hat.triggerAttackRelease('32n', time, 0.43 * sceneVolume);
    });
    Tone.getDraw().schedule(() => this.onStep(step), time);
    this.currentStep += 1;
  }

  requestScene(scene) {
    if (!SCENES.includes(scene)) return;
    if (this.playing) this.pendingScene = scene === this.activeScene ? null : scene;
    else { this.activeScene = scene; this.pendingScene = null; this.onScene(scene); }
  }

  setRhythm(name, index, active) {
    if (!DRUMS.includes(name) || index < 0 || index > 7) return;
    this.rhythm[name][index] = !!active;
  }

  setCharacter(name) {
    if (!CHARACTERS.includes(name)) return;
    this.character = name;
    this.applyCharacter();
  }

  applyCharacter() {
    // Filter and envelope changes make the three presets audibly distinct.
    const character = {
      soft: { filter: 0.42, attack: 2.4, release: 0.68 },
      bright: { filter: 1, attack: 1, release: 0.27 },
      sharp: { filter: 1.65, attack: 0.15, release: 0.11 },
    }[this.character];
    this.tracks.forEach(({ synth, filter }, index) => {
      const setting = this.settings[index];
      const baseHz = 220 * Math.pow(2, (setting.filter / 100) * 5);
      filter.frequency.rampTo(clamp(baseHz * character.filter * (index ? 0.68 : 1), 120, 13000), 0.09);
      synth.envelope.attack = Math.max(0.002, (0.004 + (setting.attack / 100) * 0.65) * character.attack);
      synth.envelope.release = character.release;
    });
  }

  setEffect(name, enabled) {
    if (!(name in this.effects)) return;
    this.effects[name] = !!enabled;
    this.applyEffects();
  }

  applyEffects() {
    this.tracks.forEach(({ delay, reverb, tremolo }, index) => {
      delay.wet.rampTo(this.effects.delay ? (index ? 0.15 : 0.25) : 0, 0.1);
      reverb.wet.rampTo(this.effects.reverb ? (index ? 0.12 : 0.23) : 0, 0.1);
      tremolo.wet.rampTo(this.effects.tremolo ? (index ? 0.43 : 0.59) : 0, 0.1);
    });
  }

  setParameter(index, parameter, value) {
    const track = this.tracks[index];
    if (!track) return;
    this.settings[index][parameter] = value;
    const { synth, channel } = track;
    if (parameter === 'volume') {
      channel.volume.value = value <= 0 ? -Infinity : -42 + 39 * Math.pow(value / 100, 0.75);
    } else if (parameter === 'portamento') {
      synth.portamento = value / 100 * 0.38;
    } else if (parameter === 'type' && WAVES.includes(value)) {
      synth.oscillator.type = value;
    } else if (parameter === 'detune') {
      synth.oscillator.detune.value = (value - 50) * 2; // ±100 cents, centered at 50.
    } else if (parameter === 'phase') {
      synth.oscillator.phase = clamp(value, 0, 100) * 3.6;
    } else if (parameter === 'filter' || parameter === 'attack') {
      this.applyCharacter();
    }
  }

  getWaveform(index) { return this.tracks[index]?.waveform.getValue() ?? null; }

  async start() {
    // Safari, Chrome: starting inside the button's user gesture unlocks audio.
    await Tone.start();
    // Convolution reverb loads its impulse response asynchronously.
    // Wait for both instances so the first click always produces sound.
    await Promise.all(this.tracks.map(({ reverb }) => reverb.ready));
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = '0:0:0';
    this.currentStep = 0;
    this.pendingScene = null;
    this.playing = true;
    transport.start('+0.06');
  }

  stop() {
    Tone.getTransport().stop();
    this.playing = false;
    this.pendingScene = null;
    this.tracks.forEach(({ synth }) => synth.triggerRelease());
  }

  dispose() {
    this.stop();
    Tone.getTransport().clear(this.repeatId);
    this.tracks.forEach((nodes) => Object.values(nodes).forEach((node) => node.dispose()));
    [this.kick, this.snare, this.hat, this.hatFilter, this.drumChannel, this.master].forEach((node) => node.dispose());
  }
}

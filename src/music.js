// Original music concept: Good morning, world!
// 108 BPM, C major, four-bar harmonic cycle: C – F – Am – G.
// Each scene keeps the same recognizable motif but changes its rhythm and density.
export const BPM = 108;
export const SCENE_INFO = {
  sleep: { label: 'Sleep', caption: 'slow / soft / floating', description: 'A quiet beginning' },
  wake: { label: 'Wake', caption: 'melody / pulse / light', description: 'The morning melody' },
  move: { label: 'Move', caption: 'rhythm / energy / motion', description: 'A brighter, faster feel' },
};

export const HARMONY = [
  { root: 'C3', fifth: 'G3' },
  { root: 'F2', fifth: 'C3' },
  { root: 'A2', fifth: 'E3' },
  { root: 'G2', fifth: 'D3' },
];

// Do – Mi – Sol – Mi | Re – Fa – Mi – Do | Sol – La – Sol – Mi | Re – Do...
export const MELODY = [
  ['C5', 'E5', 'G5', 'E5'],
  ['D5', 'F5', 'E5', 'C5'],
  ['G5', 'A5', 'G5', 'E5'],
  ['D5', 'C5', null, 'C5'],
];

// One step is an eighth note (8 steps = one bar of 4/4).
// Events are pure data, independent of Tone.js, so they are easy to test.
export function eventsForStep(scene, bar, step) {
  if (!SCENE_INFO[scene]) throw new Error(`Unknown scene: ${scene}`);
  if (!Number.isInteger(bar) || !Number.isInteger(step) || step < 0 || step > 7) {
    throw new Error('bar and step must describe an eighth-note step in a bar');
  }
  const harmony = HARMONY[bar % 4];
  const motif = MELODY[bar % 4];
  const events = [];

  if (scene === 'sleep') {
    if (step === 0) {
      events.push({ voice: 'bass', note: harmony.root, duration: '2n.', velocity: 0.52 });
      // Long individual notes let the user hear the oscillator's soft envelope.
      events.push({ voice: 'lead', note: ['C5', 'E5', 'G5', 'E5'][bar % 4], duration: '2n', velocity: 0.51 });
    }
    return events;
  }

  if (scene === 'wake') {
    if (step % 2 === 0) {
      const note = motif[step / 2];
      if (note) events.push({ voice: 'lead', note, duration: '8n.', velocity: 0.66 });
    }
    if (step === 0) events.push({ voice: 'bass', note: harmony.root, duration: '8n.', velocity: 0.70 });
    if (step === 4) events.push({ voice: 'bass', note: harmony.fifth, duration: '8n', velocity: 0.51 });
    if (step === 0 || step === 4) events.push({ voice: 'kick', velocity: 0.48 });
    if (step === 2 || step === 6) events.push({ voice: 'snare', velocity: 0.29 });
    if (step % 2 === 0) events.push({ voice: 'hat', velocity: 0.16 });
    return events;
  }

  // Move: syncopation and a more active bass. The motif remains recognizable.
  if (step % 2 === 0) {
    const note = motif[step / 2];
    if (note) events.push({ voice: 'lead', note, duration: '8n', velocity: 0.76 });
  }
  if (bar % 2 === 1 && step === 3) {
    events.push({ voice: 'lead', note: 'A5', duration: '16n', velocity: 0.38 });
  }
  if (bar % 2 === 1 && step === 7) {
    events.push({ voice: 'lead', note: 'E5', duration: '16n', velocity: 0.40 });
  }
  events.push({ voice: 'bass', note: step % 2 === 0 ? harmony.root : harmony.fifth, duration: '16n', velocity: step % 2 === 0 ? 0.70 : 0.51 });
  if (step === 0 || step === 4 || step === 7) events.push({ voice: 'kick', velocity: step === 7 ? 0.31 : 0.58 });
  if (step === 2 || step === 6) events.push({ voice: 'snare', velocity: 0.44 });
  events.push({ voice: 'hat', velocity: step % 2 === 0 ? 0.21 : 0.14 });
  return events;
}

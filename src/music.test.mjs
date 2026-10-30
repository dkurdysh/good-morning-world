import test from 'node:test';
import assert from 'node:assert/strict';
import { BPM, SCENE_INFO, eventsForStep } from './music.js';

test('three musical scenes and project tempo', () => {
  assert.equal(BPM, 108);
  assert.deepEqual(Object.keys(SCENE_INFO), ['sleep','wake','move']);
});
test('every scene contains lead and bass notes', () => {
  for (const scene of Object.keys(SCENE_INFO)) {
    const events = Array.from({ length: 4 }, (_, bar) => Array.from({ length: 8 }, (_, step) => eventsForStep(scene, bar, step))).flat(2);
    assert.ok(events.some((x) => x.voice === 'lead'), `${scene} lead`);
    assert.ok(events.some((x) => x.voice === 'bass'), `${scene} bass`);
  }
});
test('scenes progress in density from sleep to move', () => {
  const numberOfNotes = (scene) => Array.from({length:8},(_,step)=>eventsForStep(scene,1,step))
    .flat().filter((event)=>event.voice === 'lead' || event.voice === 'bass').length;
  assert.ok(numberOfNotes('sleep') < numberOfNotes('wake'));
  assert.ok(numberOfNotes('wake') < numberOfNotes('move'));
});

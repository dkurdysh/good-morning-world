import React, { useEffect, useRef, useState } from 'react';
import {
  MorningEngine, WAVES, SCENES, CHARACTERS, DRUMS, INITIAL_SETTINGS, INITIAL_RHYTHM,
} from './audio.js';

function Slider({ name, value, setValue, compact = false }) {
  return (
    <div className={`slider-control ${compact ? 'slider-control--small' : ''}`}>
      <div className="slider-head">
        <span className="slider-bound">min</span>
        <span className="slider-name">{name}</span>
        <span className="slider-bound">max</span>
      </div>
      <input
        aria-label={name}
        type="range" min="0" max="100" step="1" value={value}
        style={{ '--filled': `${value}%` }}
        onChange={(event) => setValue(Number(event.target.value))}
      />
    </div>
  );
}

function shape(wave, x, phase) {
  const t = x * Math.PI * 2 * 2.7 + phase;
  const p = (((t / (Math.PI * 2)) % 1) + 1) % 1;
  if (wave === 'square') return Math.sin(t) >= 0 ? 0.75 : -0.75;
  if (wave === 'sawtooth') return 1 - 2 * p;
  if (wave === 'triangle') return 1 - 4 * Math.abs(p - 0.5);
  return Math.sin(t);
}

function Waveform({ index, config, engine, playing }) {
  const canvasRef = useRef(null);
  const configRef = useRef(config);
  configRef.current = config;
  useEffect(() => {
    const canvas = canvasRef.current;
    let frame;
    const draw = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      if (!ctx || !w || !h) { frame = requestAnimationFrame(draw); return; }
      ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#E2FF00'; ctx.lineWidth = 2.2 * dpr;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      const samples = playing ? engine.current?.getWaveform(index) : null;
      const hasSignal = samples && Array.from(samples).some((n) => Math.abs(n) > 0.009);
      for (let px = 0; px <= w; px += 2 * dpr) {
        const n = px / w;
        const yValue = hasSignal
          ? samples[Math.min(samples.length - 1, Math.floor(n * samples.length))] * 0.88
          : shape(configRef.current.type, n, configRef.current.phase / 100 * Math.PI * 2) * 0.38;
        const y = h / 2 - yValue * h * 0.55;
        if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
      }
      ctx.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [index, engine, playing]);
  return <canvas ref={canvasRef} className="wave-canvas" aria-label={`${index === 0 ? 'Lead' : 'Bass'} live waveform visualization`} role="img" />;
}

function SynthCard({ index, config, onChange, engine, playing }) {
  const label = index === 0 ? 'Lead synth' : 'Bass synth';
  const control = (key, compact = false) => <Slider
    key={key} name={key} compact={compact} value={config[key]}
    setValue={(value) => onChange(index, key, value)}
  />;
  return (
    <section className="synth-card" aria-label={label}>
      <header className="synth-header">
        <h2>{label}</h2>
        <span className="synth-number">{index + 1}</span>
      </header>
      <Waveform index={index} config={config} engine={engine} playing={playing} />
      <div className="synth-controls">
        {control('volume')}
        {control('portamento')}
        <div className="wave-choice">
          <h3>type</h3>
          <div className="wave-buttons" role="group" aria-label={`${label} waveform type`}>
            {WAVES.map((wave) => <button
              key={wave} type="button"
              aria-pressed={config.type === wave}
              className={`wave-button ${config.type === wave ? 'is-selected' : ''}`}
              onClick={() => onChange(index, 'type', wave)}
            >{wave}</button>)}
          </div>
        </div>
        <div className="two-sliders">{control('detune', true)}{control('phase', true)}</div>
        <div className="two-sliders">{control('filter', true)}{control('attack', true)}</div>
      </div>
    </section>
  );
}

function SceneSelector({ selected, onSelect }) {
  const labels = [ ['sleep', '01 / night'], ['wake', '02 / morning'], ['move', '03 / daylight'] ];
  return <section className="scenes" aria-label="Musical states">
    <h2 className="section-heading">Your morning. Your music.</h2>
    <div className="scene-grid">
      {labels.map(([key, caption]) => <button key={key} type="button"
        onClick={() => onSelect(key)} aria-pressed={selected === key}
        className={`scene-card ${selected === key ? 'is-selected' : ''}`}>
        <span className="scene-caption">{caption}</span>
        <span className="scene-label">{key}</span>
      </button>)}
    </div>
  </section>;
}

function RhythmLab({ rhythm, onChange, currentStep, playing }) {
  return <section className="rhythm-lab" aria-label="Rhythm Lab drum machine">
    <h2>Rhythm lab</h2>
    <div className="rhythm-scroll">
      <div className="rhythm-grid">
        <span className="rhythm-corner" />
        {Array.from({ length: 8 }, (_, i) => <span key={i} className={`rhythm-count ${playing && i === currentStep ? 'is-now' : ''}`}>{String(i + 1).padStart(2, '0')}</span>)}
        {DRUMS.map((drum) => <React.Fragment key={drum}>
          <span className="rhythm-name">{drum}</span>
          {rhythm[drum].map((on, i) => <button
            key={`${drum}-${i}`} type="button"
            className={`rhythm-cell ${on ? 'is-on' : ''} ${playing && i === currentStep ? 'is-now' : ''}`}
            aria-label={`${drum} step ${i + 1}`}
            aria-pressed={on}
            onClick={() => onChange(drum, i)}
          />)}
        </React.Fragment>)}
      </div>
    </div>
  </section>;
}

export default function App() {
  const [settings, setSettings] = useState(INITIAL_SETTINGS.map((entry) => ({ ...entry })));
  const [scene, setScene] = useState('sleep');
  const [character, setCharacter] = useState('bright');
  const [effects, setEffects] = useState({ delay: false, reverb: true, tremolo: false });
  const [rhythm, setRhythm] = useState(Object.fromEntries(DRUMS.map((drum) => [drum, [...INITIAL_RHYTHM[drum]]])));
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [error, setError] = useState('');
  const engine = useRef(null);
  const busy = useRef(false);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  useEffect(() => () => { engine.current?.dispose(); engine.current = null; }, []);

  function changeParameter(index, key, value) {
    setSettings((previous) => previous.map((item, i) => i === index ? { ...item, [key]: value } : item));
    engine.current?.setParameter(index, key, value);
  }
  function changeScene(name) { setScene(name); engine.current?.requestScene(name); }
  function changeCharacter(name) { setCharacter(name); engine.current?.setCharacter(name); }
  function changeEffect(name) {
    setEffects((previous) => { const next = { ...previous, [name]: !previous[name] }; engine.current?.setEffect(name, next[name]); return next; });
  }
  function changeRhythm(drum, i) {
    setRhythm((previous) => {
      const next = { ...previous, [drum]: previous[drum].map((value, index) => index === i ? !value : value) };
      engine.current?.setRhythm(drum, i, next[drum][i]);
      return next;
    });
  }
  async function power() {
    if (busy.current) return;
    busy.current = true;
    try {
      if (playing) { engine.current?.stop(); setPlaying(false); setCurrentStep(-1); }
      else {
        if (!engine.current) {
          engine.current = new MorningEngine({
            onStep: setCurrentStep,
            onScene: (name) => { /* State already highlights the requested scene. */ },
          });
          settings.forEach((item, index) => Object.entries(item).forEach(([key, value]) => engine.current.setParameter(index, key, value)));
          engine.current.setCharacter(character);
          Object.entries(effects).forEach(([key, on]) => engine.current.setEffect(key, on));
          DRUMS.forEach((drum) => rhythm[drum].forEach((on, i) => engine.current.setRhythm(drum, i, on)));
        }
        engine.current.requestScene(sceneRef.current);
        await engine.current.start();
        setPlaying(true);
      }
      setError('');
    } catch (e) {
      console.error('Audio start error:', e);
      setError('Не удалось запустить звук. Открой проект через npm run dev, проверь громкость и нажми Power ещё раз.');
    } finally { busy.current = false; }
  }

  return <main className="page">
    <header className="hero">
      <h1><span>Good morning,</span><span>world!</span></h1>
      <button type="button" className={`power ${playing ? 'is-playing' : ''}`} aria-pressed={playing} onClick={power}>Power</button>
    </header>
    <div className="synth-grid">
      {settings.map((config, index) => <SynthCard key={index} index={index} config={config} onChange={changeParameter} engine={engine} playing={playing} />)}
    </div>
    <SceneSelector selected={scene} onSelect={changeScene} />
    <div className="effects-grid">
      <section className="choice-card" aria-label="Sound Character">
        <h2>Sound Character</h2>
        <div className="choice-buttons">{CHARACTERS.map((name) => <button key={name} type="button" onClick={() => changeCharacter(name)} aria-pressed={name === character} className={name === character ? 'character-active' : ''}>{name}</button>)}</div>
      </section>
      <section className="choice-card" aria-label="Effects">
        <h2>Effects</h2>
        <div className="choice-buttons">{Object.entries(effects).map(([name, active]) => <button key={name} type="button" onClick={() => changeEffect(name)} aria-pressed={active} className={active ? 'effect-active' : ''}>{name}</button>)}</div>
      </section>
    </div>
    <RhythmLab rhythm={rhythm} onChange={changeRhythm} currentStep={currentStep} playing={playing} />
    {error && <p className="audio-error" role="alert">{error}</p>}
    <footer><span>Daryna Kurdysh</span><span>2026</span></footer>
  </main>;
}

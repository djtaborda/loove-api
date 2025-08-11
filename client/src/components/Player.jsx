import { useEffect, useRef, useState } from "react";

function fmt(sec = 0) {
  sec = Number(sec || 0);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Player({
  track,
  url,
  onPrev,
  onNext,
  onSeek,
  shuffle,
  setShuffle,
  repeat,
  setRepeat,
}) {
  const audioRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  // Carrega a URL sempre que mudar
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    setReady(false);
    setTime(0);
    setDur(0);
    setPlaying(false);
    if (url) {
      el.src = url;
      el.load();
    } else {
      el.removeAttribute("src");
    }
  }, [url]);

  // Eventos do <audio>
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoaded = () => {
      setReady(true);
      setDur(el.duration || 0);
      // autoplay leve
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    const onUpdate = () => setTime(el.currentTime || 0);
    const onEnded = () => {
      setPlaying(false);
      if (repeat && track) {
        el.currentTime = 0;
        el.play().then(() => setPlaying(true)).catch(() => {});
      } else if (onNext) {
        onNext();
      }
    };

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onUpdate);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onUpdate);
      el.removeEventListener("ended", onEnded);
    };
  }, [track, url, repeat, onNext]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  function seek(e) {
    const el = audioRef.current;
    if (!el) return;
    const v = Number(e.target.value);
    el.currentTime = v;
    setTime(v);
    onSeek && onSeek(v);
  }

  return (
    <div className="player">
      {/* ondas fake */}
      <div className="waves" aria-hidden="true" />

      {/* titulo e pasta */}
      <div className="row">
        <div className="title">
          {track?.name || "Nenhuma música selecionada"}
        </div>
        <div className="meta">
          {fmt(time)} / {fmt(dur)} — {track?.folder || "Raiz"}
        </div>
      </div>

      {/* progresso */}
      <input
        type="range"
        min="0"
        max={Math.max(1, dur)}
        step="1"
        value={Math.min(time, dur)}
        onChange={seek}
        className="progress"
        disabled={!ready}
      />

      {/* controles - ordem: Inicio, Buscar, voltar, play/pause, avançar, shuffle, repeat */}
      <div className="controls">
        <a className="btn" href="/">🏠 Início</a>
        <a className="btn" href="/?q=">🔎 Buscar</a>

        <button className="btn" onClick={onPrev} disabled={!track}>⏮</button>
        <button className="btn orange" onClick={togglePlay} disabled={!ready}>
          {playing ? "⏸ Pausar" : "▶️ Tocar"}
        </button>
        <button className="btn" onClick={onNext} disabled={!track}>⏭</button>

        <button
          className="btn"
          onClick={() => setShuffle && setShuffle(!shuffle)}
          aria-pressed={!!shuffle}
        >
          🔀 Shuffle {shuffle ? "On" : "Off"}
        </button>

        <button
          className="btn"
          onClick={() => setRepeat && setRepeat(!repeat)}
          aria-pressed={!!repeat}
        >
          🔁 Repeat {repeat ? "On" : "Off"}
        </button>
      </div>

      <audio ref={audioRef} preload="metadata" />
    </div>
  );
}

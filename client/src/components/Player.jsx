import { useEffect, useRef, useState } from 'react';
export default function Player({ track, url, onPrev, onNext, onSeek, onFav,
onShare, onDownload, shuffle, setShuffle, repeat, setRepeat }){
const audioRef = useRef(null);
const [time, setTime] = useState(0);
const [dur, setDur] = useState(0);
useEffect(()=>{
if (audioRef.current && url) {
audioRef.current.src = url;
audioRef.current.play().catch(()=>{});
}
},[url]);
useEffect(()=>{
const id = setInterval(()=>{
navigator?.onLine; // placeholder
}, 10000);
return ()=> clearInterval(id);
},[]);
return (
<div className="player-fixed">
<div className="player">
<div className="wave" aria-hidden="true" />
<div className="row">
<div className="title">{track?.name || 'Nenhuma música
selecionada'}</div>
<div className="meta">{format(time)} / {format(dur)} —
{track?.folder || 'Raiz'}</div>
</div>
<input className="progress" type="range" min={0} max={dur||0}
value={time} onChange={(e)=> { const v = Number(e.target.value);
audioRef.current.currentTime = v; setTime(v); onSeek?.(v); }} />
<div className="controls">
<button className="btn" title="Início" onClick={()=> location.href
= '/'}> </button>
<button className="btn" title="Buscar" onClick={()=>
document.querySelector('.search')?.focus()}> </button>
<button className="btn" title="Voltar" onClick={onPrev}> </button>
<button className="btn orange" title="Play/Pause" onClick={()=>
audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause()}
>{/* central */}▶/ </button>
<button className="btn" title="Avançar" onClick={onNext}> </
button>
<button className="btn" title="Shuffle" onClick={()=> setShuffle(!
shuffle)}>{shuffle ? ' ON' : ' '}</button>
<button className="btn" title="Repeat" onClick={()=> setRepeat(!
repeat)}>{repeat ? ' ON' : ' '}</button>
<div style={{marginLeft:'auto'}}>
<audio ref={audioRef} onTimeUpdate={()=>
setTime(audioRef.current.currentTime)} onDurationChange={()=>
setDur(audioRef.current.duration||0)} onEnded={onNext} />
</div>
</div>
</div>
</div>
);
}
function format(s){ if(!Number.isFinite(s)) return '0:00'; const
m=Math.floor(s/60); const r=Math.floor(s%60).toString().padStart(2,'0');
return `${m}:${r}`; }

import { useState } from 'react';
export default function TrackMenu({ onFav, onShare, onDownload,
onAddToPlaylist }){
const [open, setOpen] = useState(false);
return (
<div className="menu">
<button className="btn" onClick={()=> setOpen(o=>!o)}>⋯</button>
{open && (
<div className="panel">
<div className="item" onClick={()=> { onShare?.();
setOpen(false); }}>Compartilhar</div>
<div className="item" onClick={()=> { onFav?.(); setOpen(false); }}
>Favoritar</div>
<div className="item" onClick={()=> { onDownload?.();
setOpen(false); }}>Baixar (Premium)</div>
<div className="item" onClick={()=> { onAddToPlaylist?.();
setOpen(false); }}>Criar/Salvar em Playlist (Premium)</div>
</div>
)}
</div>
);
}

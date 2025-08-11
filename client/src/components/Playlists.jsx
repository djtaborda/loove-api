import { useEffect, useState } from 'react';
import { User } from '../api.js';

export default function Playlists(){
  const [lists,setLists]=useState([]);
  const [name,setName]=useState('');

  async function refresh(){
    const d = await User.playlists();
    setLists(d.lists || []);
  }

  useEffect(()=>{ refresh(); },[]);

  return (
    <div className="container">
      <div className="row" style={{alignItems:'center'}}>
        <h2 style={{margin:0}}>Suas Playlists</h2>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <input
            className="search"
            placeholder="Nome da nova playlist"
            value={name}
            onChange={e=>setName(e.target.value)}
            style={{maxWidth:260}}
          />
          <button
            className="btn orange"
            onClick={async()=>{
              if(!name) return;
              await User.playlistCreate(name);
              setName('');
              refresh();
            }}>
            Criar Playlist
          </button>
        </div>
      </div>

      <div className="grid">
        {lists.map(pl=> (
          <div key={pl.id} className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:800}}>{pl.name}</div>
              <div style={{display:'flex',gap:8}}>
                <button
                  className="btn"
                  onClick={async()=>{
                    const n = prompt('Novo nome:', pl.name) || pl.name;
                    await User.playlistRename(pl.id, n);
                    refresh();
                  }}>
                  ✏️
                </button>
                <button
                  className="btn"
                  onClick={async()=>{
                    if(confirm('Excluir?')){
                      await User.playlistDelete(pl.id);
                      refresh();
                    }
                  }}>
                  🗑️
                </button>
              </div>
            </div>
            <div className="meta">{(pl.items||[]).length} músicas</div>
          </div>
        ))}
      </div>
    </div>
  );
}

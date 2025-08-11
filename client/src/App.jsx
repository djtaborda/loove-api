import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import PremiumStrip from './components/PremiumStrip.jsx';
import GenreGrid from './components/GenreGrid.jsx';
import Player from './components/Player.jsx';
import Modal from './components/Modal.jsx';
import TrackMenu from './components/TrackMenu.jsx';
import { Auth, Content, User } from './api.js';

export default function App(){
  const [me,setMe]=useState(null);
  const [search,setSearch]=useState('');
  const [folders,setFolders]=useState([]);
  const [tracks,setTracks]=useState([]);
  const [token,setToken]=useState(null);
  const [current,setCurrent]=useState(null);
  const [url,setUrl]=useState('');
  const [shuffle,setShuffle]=useState(false);
  const [repeat,setRepeat]=useState(false);
  const [showPremium,setShowPremium]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const m = await Auth.me();
        setMe(m);
      }catch{
        location.href='/login';
      }
    })();
  },[]);

  useEffect(()=>{
    (async()=>{
      try{
        const f = await Content.folders();
        setFolders(f.items || []);
      }catch{}
    })();
  },[]);

  // Busca global ao digitar (debounce)
  useEffect(()=>{
    const id = setTimeout(async()=>{
      const { items, nextToken } = await Content.tracks({ search });
      setTracks(items);
      setToken(nextToken);
    }, 200);
    return ()=> clearTimeout(id);
  },[search]);

  // Ping de sessão (tempo de uso)
  useEffect(()=>{
    const id = setInterval(()=> User.ping().catch(()=>{}), 60_000);
    return ()=> clearInterval(id);
  },[]);

  async function openFolder(f){
    setSearch('');
    const { items, nextToken } = await Content.tracks({ prefix: f.prefix });
    setTracks(items);
    setToken(nextToken);
  }

  async function play(t){
    try{
      const { url } = await Content.streamUrl(t.key);
      setUrl(url);
      setCurrent(t);
      await User.historyAdd(t.key);
    }catch(e){
      if(e.toString().includes('402')) setShowPremium(true);
    }
  }

  async function next(){
    if(!tracks.length || !current) return;
    const idx = tracks.findIndex(x=> x.key===current.key);
    if(repeat) return play(current);
    if(shuffle){
      const i = Math.floor(Math.random()*tracks.length);
      return play(tracks[i]);
    }
    const n = Math.min(tracks.length-1, idx+1);
    return play(tracks[n]);
  }

  async function prev(){
    if(!tracks.length || !current) return;
    const idx = tracks.findIndex(x=> x.key===current.key);
    if(shuffle){
      const i = Math.floor(Math.random()*tracks.length);
      return play(tracks[i]);
    }
    const p = Math.max(0, idx-1);
    return play(tracks[p]);
  }

  function share(){
    if(!current) return;
    navigator.clipboard.writeText(location.origin + '?t=' + encodeURIComponent(current.key));
    alert('Link copiado!');
  }

  function download(){
    if(!('serviceWorker' in navigator)) return alert('Indisponível');
    if(!url) return;
    navigator.serviceWorker.controller?.postMessage({ type:'DOWNLOAD_URL', url }, []);
    alert('Baixando em segundo plano. Veja em Downloads.');
  }

  return (
    <div>
      <Header search={search} setSearch={setSearch} />

      <div className="container">
        <PremiumStrip items={["Top Internacional","DJ Sets Exclusivos","Pack Nostalgia Flashback"]} />
        <GenreGrid
          folders={folders}
          onOpen={openFolder}
          onPremiumClick={()=> setShowPremium(true)}
        />

        <div style={{marginBottom:120}}>
          {tracks.map(t=> (
            <div
              key={t.key}
              className="card"
              style={{marginBottom:8, display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center'}}
            >
              <div>
                <div style={{fontWeight:800}}>{t.name}</div>
                <div className="meta">{t.folder || 'Raiz'}</div>
              </div>
              <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <button className="btn orange" onClick={()=> play(t)}>▶</button>
                <TrackMenu
                  onShare={share}
                  onFav={async()=>{ await User.favAdd(t.key); }}
                  onDownload={download}
                  onAddToPlaylist={()=> alert('Premium')}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Player
        track={current}
        url={url}
        onPrev={prev}
        onNext={next}
        onSeek={()=>{}}
        shuffle={shuffle}
        setShuffle={setShuffle}
        repeat={repeat}
        setRepeat={setRepeat}
      />

      <Modal open={showPremium} onClose={()=> setShowPremium(false)} title="Seja Premium">
        <p>Acesse playlists Premium e Gold, faça downloads offline e crie playlists.</p>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <a className="btn" onClick={()=> setShowPremium(false)}>Fechar</a>
          <a className="btn orange" href="/planos">Quero ser Premium</a>
        </div>
      </Modal>
    </div>
  );
}

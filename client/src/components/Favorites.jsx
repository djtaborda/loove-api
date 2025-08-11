import { useEffect, useState } from 'react';
import { User } from '../api.js';

export default function Favorites(){
  const [items,setItems]=useState([]);

  useEffect(()=>{
    (async()=>{
      const fav = await User.favorites();
      setItems(fav.items || []);
    })();
  },[]);

  return (
    <div className="container">
      <h2>Favoritas</h2>
      {items.length === 0 ? (
        <div className="meta">Você ainda não favoritou nenhuma música.</div>
      ) : (
        <ul>
          {items.map(k => <li key={k}>{k}</li>)}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { User } from '../api.js';

export default function History(){
  const [items,setItems]=useState([]);

  useEffect(()=>{
    (async()=>{
      const h = await User.history();
      setItems(h.items || []);
    })();
  },[]);

  return (
    <div className="container">
      <h2>Histórico</h2>
      {items.length === 0 ? (
        <div className="meta">Nenhuma música tocada ainda.</div>
      ) : (
        <ul>
          {items.map((x,i)=> (
            <li key={i}>
              {x.key} — {new Date(x.at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


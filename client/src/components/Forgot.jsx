import { useState } from 'react';
import { Auth } from '../api.js';

export default function Forgot(){
  const [email,setEmail]=useState('');
  const [sent,setSent]=useState(false);

  async function submit(){
    await Auth.forgot(email);
    setSent(true);
  }

  return (
    <div className="container" style={{maxWidth:420}}>
      <div className="card">
        <h2>Recuperar senha</h2>
        {!sent ? (
          <>
            <input
              className="search"
              placeholder="E-mail"
              value={email}
              onChange={e=>setEmail(e.target.value)}
            />
            <div style={{marginTop:12}}>
              <button className="btn orange" onClick={submit}>Enviar link</button>
            </div>
          </>
        ) : (
          <div>Se existir, enviamos o link para {email}.</div>
        )}
      </div>
    </div>
  );
}

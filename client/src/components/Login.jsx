import { useState } from 'react';
import { Auth } from '../api.js';

export default function Login(){
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [err,setErr] = useState('');

  async function submit(){
    try{
      await Auth.login(email, password);
      location.href = '/';
    }catch(e){
      setErr('E-mail ou senha inválidos');
    }
  }

  return (
    <div className="container" style={{maxWidth:420}}>
      <div className="card">
        <h2 style={{marginTop:0}}>Entrar</h2>
        <input
          className="search"
          placeholder="E-mail"
          value={email}
          onChange={e=>setEmail(e.target.value)}
        />
        <div style={{height:8}}/>
        <input
          className="search"
          placeholder="Senha"
          type="password"
          value={password}
          onChange={e=>setPassword(e.target.value)}
        />
        {err && <div style={{color:'tomato',marginTop:8}}>{err}</div>}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="btn orange" onClick={submit}>Entrar</button>
          <a className="link" href="/register">Criar conta</a>
          <a className="link" href="/forgot">Esqueci minha senha</a>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Auth } from '../api.js';

export default function Register(){
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [err,setErr]=useState('');

  async function submit(){
    try{
      await Auth.register(name,email,password);
      location.href='/';
    }catch(e){
      setErr('Não foi possível cadastrar');
    }
  }

  return (
    <div className="container" style={{maxWidth:420}}>
      <div className="card">
        <h2 style={{marginTop:0}}>Criar conta</h2>
        <input className="search" placeholder="Nome completo" value={name} onChange={e=>setName(e.target.value)} />
        <div style={{height:8}}/>
        <input className="search" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} />
        <div style={{height:8}}/>
        <input className="search" placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <div style={{color:'tomato',marginTop:8}}>{err}</div>}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="btn orange" onClick={submit}>Criar conta</button>
          <a className="link" href="/login">Entrar</a>
        </div>
      </div>
    </div>
  );
}

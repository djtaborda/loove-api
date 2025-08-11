import { useState } from 'react';
import { Auth } from '../api.js';
export default function Login(){
const [email,setEmail]=useState('');
const [password,setPassword]=useState('');
const [err,setErr]=useState('');
async function submit(){
try{ await Auth.login(email,password); location.href='/'; }catch(e){
setErr('E-mail ou senha inválidos'); }
}
return (
<div className="container" style={{maxWidth:420}}>
<div className="card">
<h2 style={{margin

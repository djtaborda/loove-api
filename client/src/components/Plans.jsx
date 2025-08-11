export default function Plans(){
  return (
    <div className="container" style={{maxWidth:820}}>
      <div className="logo" style={{marginBottom:6}}>A música sempre fez parte da sua vida</div>

      <div className="grid-2">
        <div className="card">
          <h3>Free (30 dias)</h3>
          <ul>
            <li>Sem playlists premium</li>
            <li>Sem downloads</li>
            <li>Player básico</li>
          </ul>
          <a className="btn" href="/register">Eu quero</a>
        </div>

        <div className="card">
          <h3>Premium — R$ 9,90/mês</h3>
          <ul>
            <li>Acesso às playlists Premium</li>
            <li>Downloads offline</li>
            <li>Criar playlists</li>
          </ul>
          <a className="btn orange" href="#">Eu quero</a>
        </div>

        <div className="card">
          <h3>Gold — R$ 19,90/mês</h3>
          <ul>
            <li>Premium + GOLD + bônus mensais</li>
            <li>Downloads + extras</li>
          </ul>
          <a className="btn orange" href="#">Eu quero</a>
        </div>
      </div>
    </div>
  );
}

export default function Header({ search, setSearch }) {
return (
<div className="header">
<div className="logo">Loove Music</div>
<div className="tagline">Aqui todo mundo amo música</div>
<div className="search-wrap">
<input className="search" placeholder="Buscar música…"
value={search} onChange={(e)=> setSearch(e.target.value)} />
</div>
</div>
);
}

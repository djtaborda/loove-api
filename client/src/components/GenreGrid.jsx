export default function GenreGrid({ folders, onOpen, onPremiumClick }){
return (
<div className="grid">
{folders.map(f => (
<div key={f.prefix} className="genre" onClick={() => (f.premium||
f.gold)? onPremiumClick(f) : onOpen(f)}>
{(f.premium||f.gold) && <div className="lock"> </div>}
<div>{(f.label || '').toUpperCase()}</div>
</div>
))}
</div>
);
}

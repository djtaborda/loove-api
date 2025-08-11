export default function PremiumStrip({ items }){
return (
<div className="premium-strip">
{items.map((x,i)=> (
<div key={i} className="premium-card">
<div className="small">Premium</div>
<div style={{fontWeight:800}}>{x}</div>
</div>
))}
</div>
);
}

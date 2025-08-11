export default function Modal({ open, onClose, title, children, actions }){
if (!open) return null;
return (
<div className="modal-bg" onClick={onClose}>
<div className="modal" onClick={(e)=> e.stopPropagation()}>
<div style={{fontWeight:800, marginBottom:8}}>{title}</div>
<div>{children}</div>
<div style={{display:'flex',justifyContent:'flex-end',gap:
8,marginTop:12}}>
{actions}
</div>
</div>
</div>
);
}

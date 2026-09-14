export const formatPhone=(value)=>{
  const d=(value||'').replace(/\D/g,'').slice(0,10);
  if(!d.length)return '';
  if(d.length<4)return `(${d}`;
  if(d.length<7)return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
};
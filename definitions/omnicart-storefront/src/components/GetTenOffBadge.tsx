import { useState } from 'react';

export default function GetTenOffBadge() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div id="vnsh-cta-10off" role="dialog" aria-label="Get 10% Off">
      <span>GET 10% OFF</span>
      <button className="close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
    </div>
  );
}
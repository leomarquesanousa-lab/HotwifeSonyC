'use client';
import Image from 'next/image';
import { useState } from 'react';
export default function AgeBoundary({accepted,children}:{accepted:boolean;children:React.ReactNode}) {
  const [allowed,setAllowed]=useState(accepted);
  return <><div hidden={!allowed} inert={!allowed}>{children}</div>{!allowed&&<div className="age-overlay"><section role="dialog" aria-modal="true" aria-labelledby="age-title" className="age-card"><Image src="/images/logo-hotwifesonyc.png" alt="HotwifeSonyC" width={2137} height={736} className="original-logo" unoptimized/><span className="eyebrow">ADULT AUDIENCES ONLY</span><h1 id="age-title">Welcome to<br/><em>the world of Sony C.</em></h1><p>This website contains adult themes and is intended only for people aged 18 or older, or the age of majority where you live.</p><button autoFocus className="button" onClick={()=>{document.cookie=`sony_age=confirmed; Path=/; SameSite=Lax${window.location.protocol==='https:'?'; Secure':''}`;setAllowed(true);}}>I am 18 or older · Enter ↗</button><a href="https://www.google.com" className="age-exit">Leave this site</a><p className="age-privacy">Your choice is remembered for this browser session. No date of birth or identity document is collected.</p></section></div>}</>;
}

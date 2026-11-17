'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function AdminLogin() {
  const router=useRouter();
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function login(event: React.FormEvent<HTMLFormElement>) {event.preventDefault();setBusy(true);setError('');const form=new FormData(event.currentTarget);try {const response=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:form.get('password')})});const data=await response.json();if(!response.ok)throw new Error(data.error);router.push('/admin');router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <form onSubmit={login} className="admin-login"><label>Administrator password<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>{error&&<p role="alert" className="form-error">{error}</p>}<button className="button" disabled={busy}>{busy?'Signing in…':'Sign in ↗'}</button><p>Private content management. Sessions expire after eight hours.</p></form>;
}

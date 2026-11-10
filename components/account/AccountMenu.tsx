'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import SignOutButton from '@/components/storefront/SignOutButton';
import styles from './AccountMenu.module.css';
export default function AccountMenu({ administrative = false }: { administrative?: boolean }) {
  const [profile,setProfile] = useState<{name:string;hasPhoto:boolean}|null>(null);
  const [version,setVersion] = useState(0);
  const [failed,setFailed] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { void fetch('/api/account/profile',{cache:'no-store',signal:controller.signal}).then(async response => { if (!controller.signal.aborted) { setProfile(response.ok ? await response.json() : null); setFailed(false); setVersion(value=>value+1); } }).catch(()=>{}); };
    refresh(); window.addEventListener('creator-platform:profile-updated',refresh);
    const close = (event: PointerEvent) => { if (details.current && !details.current.contains(event.target as Node)) details.current.open=false; };
    document.addEventListener('pointerdown',close);
    return () => {controller.abort();window.removeEventListener('creator-platform:profile-updated',refresh);document.removeEventListener('pointerdown',close);};
  },[]);
  return <details ref={details} className={styles.root} onKeyDown={event=>{if(event.key==='Escape'&&details.current){details.current.open=false;details.current.querySelector('summary')?.focus();}}}><summary className={styles.trigger} aria-label="Account menu"><span className={styles.avatar}>{profile?.hasPhoto&&!failed?<img src={'/api/account/profile/photo?v='+version} alt="Your profile" onError={()=>setFailed(true)}/>:profile?.name&&profile.name!=='My profile'?profile.name.split(/\s+/).map(part=>part[0]).slice(0,2).join(''):<UserRound size={18} aria-hidden="true"/>}</span><span className={styles.name}>{profile?.name??'Account'}</span></summary><div className={styles.panel} onClick={event=>{if((event.target as HTMLElement).closest('a')&&details.current)details.current.open=false;}}>{profile?<><Link href={administrative?'/app/settings#my-account':'/account'}>My Account</Link><Link href="/account#profile-photo">Change profile photo</Link><Link href="/my-videos">My Videos</Link>{administrative&&<Link href="/app/settings">Settings</Link>}<SignOutButton/></>:<Link href="/login">Sign In</Link>}</div></details>;
}

'use client';
import { useState, type FormEvent } from 'react';
import type { AdministrativeUser } from '@/src/lib/auth/admin-users';
const field = 'w-full rounded-lg border border-white/15 bg-[#111827] px-3 py-3 text-sm';
const button = 'min-h-11 rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-50';
export default function AdministrativeUsers({ initialUsers }: { initialUsers: AdministrativeUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function mutate(path: string, method: string, value: unknown) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === 'EMAIL_ALREADY_EXISTS' ? 'An account with this email already exists.' : 'Unable to update administrative access.');
      if (method === 'POST') { setName(''); setEmail(''); setPassword(''); }
      const refreshed = await fetch('/api/admin/users');
      if (!refreshed.ok) throw new Error('Unable to refresh administrative users.');
      setUsers((await refreshed.json()).users); setNotice('Administrative access updated.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to update administrative access.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy) await mutate('/api/admin/users', 'POST', { name, email, password, role });
  }
  return <main className="mx-auto max-w-5xl p-5 sm:p-8"><h1 className="text-3xl font-semibold">Administrative Users</h1>
    <p className="mt-3 text-sm text-white/45">Only the owner can manage administrative access. Owner accounts are protected.</p>
    {error && <p role="alert" className="mt-5 text-sm text-rose-300">{error}</p>}{notice && <p role="status" className="mt-5 text-sm text-emerald-300">{notice}</p>}
    <form onSubmit={submit} className="mt-7 rounded-xl border border-white/10 p-5"><h2 className="mb-5 font-medium">Create Administrative User</h2>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-xs text-white/65">Name<input className={field} required minLength={2} maxLength={160} value={name} onChange={event => setName(event.target.value)} autoComplete="name"/></label>
        <label className="grid gap-2 text-xs text-white/65">Email<input className={field} required type="email" maxLength={255} value={email} onChange={event => setEmail(event.target.value)} autoComplete="off"/></label>
        <label className="grid gap-2 text-xs text-white/65">Initial Password<input className={field} required type="password" minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password"/><span>At least 12 characters, including uppercase, lowercase, a number, and a symbol.</span></label>
        <label className="grid gap-2 text-xs text-white/65">Role<select className={field} value={role} onChange={event => setRole(event.target.value)}><option value="ADMIN">ADMIN</option><option value="OPERATOR">OPERATOR</option></select></label>
        <button className={`${button} bg-violet-500/20 sm:col-span-2`} type="submit">{busy ? 'Saving...' : 'Create User'}</button>
      </fieldset>
    </form>
    <section className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10 px-5">{users.map(user => <article key={user.membershipId} className="flex flex-wrap items-center justify-between gap-4 py-5">
      <div className="min-w-0"><h2 className="font-medium">{user.name || user.email}</h2><p className="mt-1 break-all text-xs text-white/45">{user.email}</p><p className="mt-2 text-xs text-white/45">{user.role} · {user.status}</p></div>
      {user.role === 'OWNER' ? <span className="text-xs text-white/35">Protected Owner</span> : <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void mutate(`/api/admin/users/${user.membershipId}`, 'PATCH', { action: 'CHANGE_ROLE', role: user.role === 'ADMIN' ? 'OPERATOR' : 'ADMIN' })}>Change to {user.role === 'ADMIN' ? 'OPERATOR' : 'ADMIN'}</button>
        <button className={`${button} text-rose-300`} disabled={busy} onClick={() => { if (window.confirm(`Remove administrative access for ${user.email}? The account will remain available as a customer.`)) void mutate(`/api/admin/users/${user.membershipId}`, 'PATCH', { action: 'REMOVE_ACCESS' }); }}>Remove Admin Access</button>
      </div>}
    </article>)}</section>
  </main>;
}

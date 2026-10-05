'use client';
import { useState, type FormEvent } from 'react';
export default function ChangePasswordForm() {
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [success,setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const password = String(fields.get('password') ?? '');
    const confirmPassword = String(fields.get('confirmPassword') ?? '');
    if (password !== confirmPassword) {setSuccess(false);setMessage('The new passwords do not match.');return;}
    setBusy(true);setMessage('');setSuccess(false);
    try {
      const response = await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:String(fields.get('currentPassword') ?? ''),password,confirmPassword})});
      const result = await response.json();
      if (!response.ok || !result.success) {
        const messages: Record<string,string> = { INVALID_CREDENTIALS: 'Your current password is incorrect.', UNAUTHORIZED: 'Your session has expired. Sign in again.', RATE_LIMITED: 'Too many attempts. Please try again later.', PASSWORD_MISMATCH: 'The new passwords do not match.' };
        throw new Error(messages[result.error] ?? 'Unable to change your password. Check the password requirements and try again.');
      }
      form.reset();setSuccess(true);setMessage('Your password has been updated.');
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Unable to change your password.');}
    finally {setBusy(false);}
  }
  const inputClass = 'min-h-11 w-full rounded-lg border border-white/10 bg-[#101623] px-3 text-sm text-white outline-none focus:border-blue-400/60';
  return <form onSubmit={submit} className="mt-5 max-w-lg"><fieldset disabled={busy} className="space-y-4"><label className="grid gap-2 text-xs text-white/50">Current Password<input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" className={inputClass}/></label><label className="grid gap-2 text-xs text-white/50">New Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className={inputClass}/></label><label className="grid gap-2 text-xs text-white/50">Confirm New Password<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className={inputClass}/></label><p className="text-[11px] leading-5 text-white/35">Use at least 12 characters, including uppercase and lowercase letters, a number, and a symbol.</p><button type="submit" className="min-h-11 rounded-lg border border-blue-400/20 bg-blue-500/10 px-4 text-xs text-blue-200 disabled:opacity-50">{busy ? 'Updating...' : 'Change Password'}</button></fieldset>{message && <p role={success ? 'status' : 'alert'} className={`mt-4 text-xs ${success ? 'text-emerald-300' : 'text-amber-200'}`}>{message}</p>}</form>;
}

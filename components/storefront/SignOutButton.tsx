'use client';
import { useState } from 'react';

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Unable to sign out. Please try again.');
      window.location.replace('/');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to sign out.');
      setBusy(false);
    }
  }
  return <div><button type="button" className="store-button secondary" disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing Out...' : 'Sign Out'}</button>{error && <p role="alert">{error}</p>}</div>;
}

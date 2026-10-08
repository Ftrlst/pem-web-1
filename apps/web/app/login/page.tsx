'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, setAccessToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('kletak_user')) router.replace('/pesanan');
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await login(email, password)
          : await register(name, email, phone || undefined, password);
      setAccessToken(result.accessToken);
      localStorage.setItem('kletak_user', JSON.stringify(result.user));
      router.push(result.user.role === 'CUSTOMER' ? '/pesanan' : '/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Autentikasi gagal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="container">
        <div className="content-card auth-card">
          <div className="page-header" style={{ marginBottom: 25 }}>
            <span className="eyebrow">WELCOME BACK</span>
            <h1 style={{ fontSize: 42 }}>{mode === 'login' ? 'Masuk akun' : 'Buat akun'}</h1>
            <p>
              {mode === 'login'
                ? 'Lacak pesanan dan nikmati checkout yang lebih cepat.'
                : 'Simpan pesananmu dan akses promo member.'}
            </p>
          </div>
          <div className="auth-switch">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
              Masuk
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              Daftar
            </button>
          </div>
          <form onSubmit={submit}>
            <div className="form-grid">
              {mode === 'register' ? (
                <>
                  <div className="form-field full">
                    <label htmlFor="name">Nama</label>
                    <input
                      id="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="form-field full">
                    <label htmlFor="phone">Nomor HP (opsional)</label>
                    <input
                      id="phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="08xxxxxxxxxx"
                    />
                  </div>
                </>
              ) : null}
              <div className="form-field full">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="form-field full">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === 'register' ? 12 : 1}
                />
              </div>
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button button-primary button-wide" disabled={busy}>
              {busy ? 'Tunggu sebentar…' : mode === 'login' ? 'Masuk' : 'Buat akun'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

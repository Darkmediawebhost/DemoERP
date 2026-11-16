import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ErrorText } from '@/components/ui';
import { useAuth } from '@/context';
import { api, errorMessage } from '@/lib/api';

type AuthConfig = { loginEmail: string; google: boolean; googleClientId?: string; otp: boolean };

type GoogleTokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            hint?: string;
            include_granted_scopes?: boolean;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (error: { message?: string; type?: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [step, setStep] = useState<'choose' | 'code'>('choose');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const email = config?.loginEmail || 'darkmediatech4@gmail.com';

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);
  useEffect(() => {
    api.get('/auth/config').then((response) => setConfig(response.data.data)).catch(() => setConfig(null));
  }, []);

  async function google() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const clientId = config?.googleClientId;
      if (!clientId) {
        throw new Error('Add GOOGLE_CLIENT_ID from Google Cloud to .env, then restart the API. Firebase is not used.');
      }
      const accessToken = await requestGoogleAccessToken(clientId, email);
      const response = await api.post('/auth/google', { accessToken });
      setUser(response.data.data);
      navigate('/');
    } catch (err) {
      setError(readable(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/auth/otp/request', { email });
      setStep('code');
      setCode('');
      setNotice(`A 6-digit code is on its way to ${email}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError('Enter the 6-digit code from Gmail.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/auth/otp/verify', { email, code });
      setUser(response.data.data);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-black text-white lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between px-8 py-10 sm:px-14 sm:py-14 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-sm font-bold text-black">DM</span>
          <div>
            <p className="text-sm tracking-[0.22em]">DARK MEDIA</p>
            <p className="text-xs text-neutral-500">Company ERP</p>
          </div>
        </div>
        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Sign in to the company books.</h1>
          <p className="mt-5 text-base leading-7 text-neutral-400">One company Gmail opens the ledger. Google, or a code sent to that inbox.</p>
        </div>
        <p className="text-xs text-neutral-500">Sajeel · Shakeeb · Ismail</p>
      </section>

      <section className="flex min-h-dvh items-center bg-[#F7F7F7] px-4 py-8 text-black sm:px-12 sm:py-12" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-full max-w-md rounded-3xl border border-[#E5E5E5] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-9">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-sm font-bold text-lime">DM</span>
            <p className="text-sm font-semibold tracking-[0.18em]">DARK MEDIA</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737373]">Dark Media</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-[#737373]">Only this Gmail can continue. Any other Google account is refused.</p>

          <div className="mt-6 rounded-2xl border border-[#E5E5E5] bg-[#F7F7F7] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">Company Gmail</p>
            <p className="mt-1 break-all text-sm font-semibold">{email}</p>
          </div>

          {step === 'choose' ? (
            <div className="mt-6 space-y-3">
              <Button className="h-11 w-full" disabled={busy} onClick={google}>
                <GoogleMark />
                Continue with Google
              </Button>
              <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-[#A3A3A3]">
                <span className="h-px flex-1 bg-[#E5E5E5]" />
                or
                <span className="h-px flex-1 bg-[#E5E5E5]" />
              </div>
              <Button className="h-11 w-full" variant="ghost" disabled={busy} onClick={sendCode}>Email a code to this Gmail</Button>
            </div>
          ) : (
            <form className="mt-6 space-y-3" onSubmit={verifyCode}>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[#737373]">Code from Gmail</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3 py-3 text-center text-2xl font-semibold tracking-[0.4em] outline-none focus:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#92E622]"
                />
              </label>
              <Button className="h-11 w-full" disabled={busy || code.length !== 6} type="submit">Enter</Button>
              <button type="button" className="w-full text-sm font-semibold text-[#737373]" disabled={busy} onClick={() => { setStep('choose'); setCode(''); setError(''); setNotice(''); }}>
                Use a different method
              </button>
            </form>
          )}

          {notice && <p className="mt-4 text-sm text-[#737373]">{notice}</p>}
          {error && <div className="mt-4"><ErrorText>{error}</ErrorText></div>}

          {config && (!config.google || !config.otp) && (
            <div className="mt-6 space-y-2 border-t border-[#E5E5E5] pt-5 text-xs leading-5 text-[#737373]">
              {!config.otp && <p>The Gmail code needs a Google App Password in <span className="font-semibold text-black">SMTP_PASS</span>, then a restart of the API.</p>}
              {!config.google && <p>Continue with Google uses Google Cloud, not Firebase. Put the OAuth client ID in <span className="font-semibold text-black">GOOGLE_CLIENT_ID</span>.</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-auth="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google sign-in could not load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.googleAuth = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google sign-in could not load.'));
    document.head.appendChild(script);
  });
}

function requestGoogleAccessToken(clientId: string, loginHint: string) {
  return loadGoogleScript().then(() => new Promise<string>((resolve, reject) => {
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth) {
      reject(new Error('Google sign-in could not load.'));
      return;
    }
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      hint: loginHint,
      callback: (response) => {
        if (!response.access_token || response.error) {
          reject(new Error('Google sign-in was cancelled.'));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error) => reject(new Error(error.message || 'Google sign-in was cancelled.')),
    });
    client.requestAccessToken({ prompt: 'select_account' });
  }));
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.4 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function readable(error: unknown) {
  if (typeof error === 'object' && error && 'isAxiosError' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (!response) return 'Sign-in was interrupted because the server restarted. Try again.';
  }
  if (error instanceof Error && error.message && !('isAxiosError' in error)) {
    const apiText = errorMessage(error);
    if (apiText !== 'Something went wrong. Try again.') return apiText;
    return error.message;
  }
  return errorMessage(error);
}

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { InstallChoices } from '@/components/InstallApp';
import { Button, ErrorText } from '@/components/ui';
import { useAuth } from '@/context';
import { api, errorMessage, saveSession } from '@/lib/api';

type AuthConfig = { demoUsername?: string; demoPassword?: string; lanHost?: string };

const fallbackUsername = 'darkmediaerp';
const fallbackPassword = 'darkmediaerp';

export function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(fallbackUsername);
  const [password, setPassword] = useState(fallbackPassword);
  const [hint, setHint] = useState({ username: fallbackUsername, password: fallbackPassword });
  const [lanHost, setLanHost] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);
  useEffect(() => {
    api.get('/auth/config').then((response) => {
      const data = response.data.data as AuthConfig;
      const next = {
        username: data.demoUsername || fallbackUsername,
        password: data.demoPassword || fallbackPassword,
      };
      setHint(next);
      setUsername(next.username);
      setPassword(next.password);
      if (data.lanHost) setLanHost(data.lanHost);
    }).catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await api.post('/auth/login', { username, password });
      saveSession(response.data.token);
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
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-sm font-bold text-black">DE</span>
          <p className="text-sm tracking-[0.22em]">DEMO ERP</p>
        </div>
        <div className="max-w-lg">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Sign in to the company books.</h1>
          <p className="mt-5 text-base leading-7 text-neutral-400">DEMO ERP opens with a username and password. No email is required.</p>
        </div>
        <p className="text-xs text-neutral-500">Sajeel · Shakeeb · Ismail</p>
      </section>

      <section className="flex min-h-dvh items-center bg-[#F7F7F7] px-4 py-8 text-black sm:px-12 sm:py-12" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto w-full max-w-md rounded-3xl border border-[#E5E5E5] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.06)] sm:p-9">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-sm font-bold text-lime">DE</span>
            <p className="text-sm font-semibold tracking-[0.18em]">DEMO ERP</p>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#737373]">DEMO ERP</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-[#737373]">Use the DEMO ERP username and password. Email is not required.</p>

          <div className="mt-6 rounded-2xl border border-[#D6F5A2] bg-[#F4FBE6] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#3F6212]">Sign-in hint</p>
            <p className="mt-2 text-sm"><span className="text-[#737373]">Username</span> <span className="font-semibold">{hint.username}</span></p>
            <p className="mt-1 text-sm"><span className="text-[#737373]">Password</span> <span className="font-semibold">{hint.password}</span></p>
          </div>

          <form className="mt-6 space-y-3" onSubmit={submit}>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-[#737373]">Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full rounded-xl border border-[#E5E5E5] bg-white px-3 py-3 text-sm outline-none focus:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#92E622]"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-[#737373]">Password</span>
              <span className="relative block">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-[#E5E5E5] bg-white py-3 pl-3 pr-12 text-sm outline-none focus:border-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#92E622]"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#737373] hover:text-black"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((open) => !open)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <Button className="h-11 w-full" disabled={busy} type="submit">Sign in</Button>
          </form>

          {error && <div className="mt-4"><ErrorText>{error}</ErrorText></div>}
          <InstallChoices host={lanHost} />
        </div>
      </section>
    </div>
  );
}

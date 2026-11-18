import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, Link2, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Empty, ErrorText, Field, PageHeader, TextInput } from '@/components/ui';
import { useToast } from '@/context';
import { api, errorMessage } from '@/lib/api';

type WorkLink = { _id: string; name: string; url: string; createdAt?: string };

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function linkKind(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('drive.google.') || host.includes('docs.google.') || host.includes('dropbox.')) return 'Drive';
    return 'Website';
  } catch {
    return 'Link';
  }
}

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function WorksPage() {
  const toast = useToast();
  const [rows, setRows] = useState<WorkLink[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');

  const load = () => {
    api.get('/works').then((response) => setRows(response.data.data)).catch((err) => setError(errorMessage(err)));
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(needle) || row.url.toLowerCase().includes(needle));
  }, [query, rows]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const nextUrl = normalizeUrl(url);
    if (!name.trim() || !nextUrl) {
      setError('Enter a name and a website or Drive link.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/works', { name: name.trim(), url: nextUrl });
      setName('');
      setUrl('');
      toast('Link saved');
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const copy = async (row: WorkLink) => {
    try {
      await navigator.clipboard.writeText(row.url);
      setCopied(row._id);
      toast('Link copied');
      window.setTimeout(() => setCopied((current) => (current === row._id ? '' : current)), 1600);
    } catch {
      setError('Could not copy that link.');
    }
  };

  const remove = async (row: WorkLink) => {
    try {
      await api.delete(`/works/${row._id}`);
      setRows((current) => current.filter((item) => item._id !== row._id));
      toast('Link removed');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader title="Our works" text="Save a name with a website or Drive link, then copy it when you need it." />
      <Card className="mb-5">
        <form className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] md:items-end" onSubmit={save}>
          <Field label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Client website" maxLength={120} required />
          </Field>
          <Field label="Website or Drive link">
            <TextInput value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https:// or a Drive link" inputMode="url" required />
          </Field>
          <Button type="submit" disabled={saving} className="md:w-auto">{saving ? 'Saving…' : 'Save link'}</Button>
        </form>
        {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}
      </Card>
      <div className="mb-4">
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or link" aria-label="Search links" />
      </div>
      {visible.length === 0 ? (
        <Empty title={rows.length === 0 ? 'No links yet' : 'No matching links'} text={rows.length === 0 ? 'Add the first website or Drive link above.' : 'Try another name or link.'} />
      ) : (
        <div className="grid gap-3">
          {visible.map((row) => (
            <article key={row._id} className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold">{row.name}</h2>
                  <Badge tone={linkKind(row.url) === 'Drive' ? 'lime' : 'neutral'}>{linkKind(row.url)}</Badge>
                </div>
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-secondary">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{hostLabel(row.url)}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" variant="ghost" className="sm:w-auto" onClick={() => copy(row)}>
                  {copied === row._id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied === row._id ? 'Copied' : 'Copy'}
                </Button>
                <a href={row.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-semibold hover:bg-tint">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
                <Button type="button" variant="quiet" className="sm:w-auto" aria-label={`Remove ${row.name}`} onClick={() => remove(row)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

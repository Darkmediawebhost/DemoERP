import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Badge, Button, Card, Empty, ErrorText, Field, Modal, Money, PageHeader, Select, Spinner, Table, Td, TextArea, TextInput, Th } from '@/components/ui';
import { useToast } from '@/context';
import { api, errorMessage, idempotencyKey } from '@/lib/api';
import { inr, PRESETS, periodRange, statusTone, titleCase, todayKey, weekRange } from '@/lib/format';
import { downloadInvoicePdf } from '@/lib/invoicePdf';
import { PROJECT_STATUSES } from '@/lib/labels';

type Row = Record<string, any>;

const SERVICE_TYPES = [
  { value: 'monthly_subscription', label: 'Monthly subscription' },
  { value: 'project_based', label: 'Project based' },
  { value: 'other', label: 'Other' },
];

function serviceTypeLabel(row: Row) {
  if (row.serviceType === 'other') return row.serviceTypeOther || 'Other';
  return SERVICE_TYPES.find((item) => item.value === row.serviceType)?.label || row.serviceType || '—';
}

function clientDate(row: Row) {
  if (row.startDate) return String(row.startDate);
  if (!row.createdAt) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.createdAt));
}

function clientFormValues(row?: Row | null) {
  return {
    name: row?.name || '',
    companyName: row?.companyName || '',
    phone: row?.phone || '',
    email: row?.email || '',
    service: row?.service || '',
    serviceType: row?.serviceType || 'monthly_subscription',
    serviceTypeOther: row?.serviceTypeOther || '',
    monthlyAmount: row?.monthlyAmountPaise ? (Number(row.monthlyAmountPaise) / 100).toFixed(2) : '',
    status: row?.status || 'active',
  };
}

function clientFormPayload(values: Record<string, string>, editing: boolean) {
  return {
    name: values.name,
    companyName: values.companyName,
    phone: values.phone,
    email: values.email,
    service: values.service,
    serviceType: values.serviceType,
    serviceTypeOther: values.serviceType === 'other' ? values.serviceTypeOther : '',
    monthlyAmount: values.serviceType === 'monthly_subscription' ? (values.monthlyAmount || '0') : '0',
    status: values.status || 'active',
    ...(editing ? {} : { startDate: todayKey() }),
  };
}

async function removeClient(row: Row) {
  const confirmed = window.confirm(`Delete ${row.name}? Projects and tasks for this client are removed too.`);
  if (!confirmed) return false;
  await api.delete(`/clients/${row._id}`);
  return true;
}

function ClientEditor({ client, onClose, onSaved }: { client: Row | null; onClose: () => void; onSaved: (saved?: Row) => void }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const form = useForm<Record<string, string>>({ defaultValues: clientFormValues(client) });
  const serviceType = form.watch('serviceType');
  return (
    <Modal title={client ? `Edit ${client.name}` : 'New client'} onClose={onClose}>
      <form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => {
        try {
          const payload = clientFormPayload(values, Boolean(client));
          if (client) await api.patch(`/clients/${client._id}`, payload);
          else await api.post('/clients', payload);
          toast(client ? 'Client updated' : 'Client added');
          onSaved();
        } catch (err) { setError(errorMessage(err)); }
      })}>
        <Field label="Client name"><TextInput placeholder="Client name" {...form.register('name', { required: true })} /></Field>
        <Field label="Service"><TextInput placeholder="Website, branding, video…" {...form.register('service', { required: true })} /></Field>
        <Field label="Service type">
          <Select {...form.register('serviceType', { required: true })}>
            {SERVICE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </Field>
        {serviceType === 'other' && <Field label="Other service type"><TextInput placeholder="Type the service type" {...form.register('serviceTypeOther', { required: true })} /></Field>}
        {serviceType === 'monthly_subscription' && <Field label="Monthly amount (INR)"><TextInput inputMode="decimal" placeholder="0.00" {...form.register('monthlyAmount')} /></Field>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company"><TextInput {...form.register('companyName')} /></Field>
          <Field label="Phone"><TextInput {...form.register('phone')} /></Field>
        </div>
        <Field label="Email"><TextInput type="email" {...form.register('email')} /></Field>
        {client && (
          <Field label="Status">
            <Select {...form.register('status')}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit">{client ? 'Save changes' : 'Save client'}</Button>
      </form>
    </Modal>
  );
}

export function ClientsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState<Row | null | undefined>(undefined);
  const [error, setError] = useState('');
  const load = () => api.get('/clients', { params: { q: query || undefined, serviceType: typeFilter || undefined } }).then((response) => setRows(response.data.data)).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, [query, typeFilter]);
  return (
    <div>
      <PageHeader title="Clients" text="Name the client, the service, and how it is billed. Other service types can be typed in." action={<Button onClick={() => { setError(''); setEditing(null); }}>Add client</Button>} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <TextInput className="w-full sm:max-w-sm" placeholder="Search clients or services" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select className="w-full sm:max-w-[220px]" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">All service types</option>
          {SERVICE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </div>
      {error && editing === undefined && <ErrorText>{error}</ErrorText>}
      {rows.length === 0 ? <Empty title="No clients" text="Add a client with a service and a service type." /> : (
        <Table>
          <thead><tr><Th>Client name</Th><Th>Date</Th><Th>Service</Th><Th>Service type</Th><Th>Status</Th><Th>Monthly</Th><Th /></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="hover:bg-tint">
                <Td><Link className="font-semibold" to={`/clients/${row._id}`}>{row.name}</Link><p className="text-xs text-secondary">{row.companyName}</p></Td>
                <Td>{clientDate(row) || '—'}</Td>
                <Td>{row.service || '—'}</Td>
                <Td>{serviceTypeLabel(row)}</Td>
                <Td><Badge tone={statusTone(row.status)}>{row.status}</Badge></Td>
                <Td>{row.serviceType === 'monthly_subscription' ? <Money paise={row.monthlyAmountPaise} /> : '—'}</Td>
                <Td>
                  <span className="flex justify-end gap-1">
                    <Button variant="quiet" type="button" onClick={() => { setError(''); setEditing(row); }}>Edit</Button>
                    <Button variant="quiet" type="button" onClick={async () => { try { if (await removeClient(row)) { toast('Client deleted'); load(); } } catch (err) { setError(errorMessage(err)); } }}>Delete</Button>
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing !== undefined && <ClientEditor client={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
    </div>
  );
}

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<Row | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const load = () => api.get(`/clients/${id}`).then((response) => setData(response.data));
  useEffect(() => { load(); }, [id]);
  if (!data) return <Spinner />;
  const client = data.data;
  return (
    <div className="space-y-4">
      <PageHeader
        title={client.name}
        text={[clientDate(client) ? `Added ${clientDate(client)}` : '', client.service, serviceTypeLabel(client), client.companyName, client.email, client.phone].filter(Boolean).join(' · ')}
        action={(
          <>
            <Button variant="ghost" type="button" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="danger" type="button" onClick={async () => { try { if (await removeClient(client)) { toast('Client deleted'); navigate('/clients'); } } catch (err) { setError(errorMessage(err)); } }}>Delete</Button>
          </>
        )}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="mb-2 font-semibold">Projects</h2>{(data.projects || []).map((row: Row) => <p key={row._id}>{row.name} · {row.status}</p>)}{!data.projects?.length && <p className="text-sm text-secondary">No projects.</p>}</Card>
        <Card><h2 className="mb-2 font-semibold">Payments</h2>{(data.payments || []).map((row: Row) => <p key={row._id}>{row.periodKey} · {row.status} · <Money paise={row.invoiceAmountPaise - row.amountReceivedPaise} /></p>)}{!data.payments?.length && <p className="text-sm text-secondary">No schedules.</p>}</Card>
        <Card><h2 className="mb-2 font-semibold">Invoices</h2>{(data.invoices || []).map((row: Row) => <p key={row._id}>{row.number || 'Draft'} · {row.status}</p>)}</Card>
        <Card><h2 className="mb-2 font-semibold">Notes</h2><p className="text-sm text-secondary">{client.internalNotes || 'No internal notes.'}</p></Card>
      </div>
      {editing && <ClientEditor client={client} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}

const BOARD = [
  { id: 'To Do', label: 'To do', hint: 'Not started' },
  { id: 'In Progress', label: 'In progress', hint: 'Being worked on' },
  { id: 'Completed', label: 'Done', hint: 'Finished' },
];

function taskInColumn(task: Row, columnId: string) {
  if (columnId === 'In Progress') return task.status === 'In Progress' || task.status === 'Review';
  return task.status === columnId;
}

function projectOf(task: Row, projects: Row[]) {
  const id = String(task.projectId?._id || task.projectId || '');
  return projects.find((item) => item._id === id);
}

function taskClientName(task: Row, projects: Row[]) {
  return projectOf(task, projects)?.clientId?.name || 'No client';
}

const QUICK_FILTERS = [
  { id: 'all', label: 'All tasks' },
  { id: 'week_done', label: 'Completed this week' },
  { id: 'week_due', label: 'Due this week' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'high', label: 'High priority' },
];

function completedKey(task: Row) {
  if (task.status !== 'Completed') return '';
  if (task.completedOn) return task.completedOn;
  if (!task.updatedAt) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(task.updatedAt));
}

function matchesQuickFilter(task: Row, filter: string) {
  const today = todayKey();
  const week = weekRange(today);
  if (filter === 'week_done') {
    const done = completedKey(task);
    return Boolean(done && done >= week.from && done <= week.to);
  }
  if (filter === 'week_due') return Boolean(task.dueDate && task.dueDate >= week.from && task.dueDate <= week.to && task.status !== 'Completed');
  if (filter === 'overdue') return Boolean(task.dueDate && task.dueDate < today && task.status !== 'Completed');
  if (filter === 'high') return task.priority === 'high' && task.status !== 'Completed';
  return true;
}

export function ProjectsPage() {
  const toast = useToast();
  const skipClick = useRef(false);
  const [projects, setProjects] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [clients, setClients] = useState<Row[]>([]);
  const [projectFilter, setProjectFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openProject, setOpenProject] = useState(false);
  const [composer, setComposer] = useState<string | null>(null);
  const [addProjectId, setAddProjectId] = useState('');
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState<Row | null>(null);
  const [over, setOver] = useState('');
  const [error, setError] = useState('');
  const form = useForm<Record<string, string>>({ defaultValues: { status: 'Planning', priority: 'normal' } });
  const load = () => Promise.all([api.get('/projects'), api.get('/tasks'), api.get('/clients')]).then(([projectRes, taskRes, clientRes]) => {
    setProjects(projectRes.data.data);
    setTasks(taskRes.data.data);
    setClients(clientRes.data.data);
  }).catch((err) => setError(errorMessage(err)));
  useEffect(() => { load(); }, []);

  const board = tasks.filter((task) => {
    const project = projectOf(task, projects);
    const clientId = project?.clientId?._id;
    const taskProjectId = String(task.projectId?._id || task.projectId || '');
    const query = search.trim().toLowerCase();
    const clientName = taskClientName(task, projects).toLowerCase();
    const projectName = String(project?.name || '').toLowerCase();
    const matchesSearch = !query || task.title.toLowerCase().includes(query) || clientName.includes(query) || projectName.includes(query);
    return matchesSearch && (projectFilter === 'all' || taskProjectId === projectFilter) && (clientFilter === 'all' || clientId === clientFilter) && matchesQuickFilter(task, quickFilter);
  });
  const selectedProject = projects.find((item) => item._id === projectFilter);
  const doneCount = board.filter((task) => task.status === 'Completed').length;

  function openComposer(status: string) {
    setComposer(status);
    setDraft('');
    setError('');
    const fallback = projects.find((item) => item._id === projectFilter)?._id || projects[0]?._id || '';
    setAddProjectId(fallback);
  }

  async function addTask(status: string) {
    const title = draft.trim();
    const projectId = projects.some((item) => item._id === addProjectId) ? addProjectId : (projects[0]?._id || '');
    if (!title || !projectId) return;
    try {
      await api.post('/tasks', { projectId, title, status, priority: 'normal' });
      setDraft('');
      setComposer(null);
      setError('');
      toast('Task added');
      load();
    } catch (err) { setError(errorMessage(err)); }
  }

  async function moveTask(taskId: string, status: string) {
    setTasks((current) => current.map((task) => (task._id === taskId ? { ...task, status, completedOn: status === 'Completed' ? todayKey() : '' } : task)));
    setOver('');
    try {
      await api.patch(`/tasks/${taskId}`, { status });
      load();
    } catch (err) {
      setError(errorMessage(err));
      load();
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    try {
      await api.patch(`/tasks/${active._id}`, {
        title: String(data.get('title') || ''),
        description: String(data.get('description') || ''),
        dueDate: String(data.get('dueDate') || ''),
        priority: String(data.get('priority') || 'normal'),
        status: String(data.get('status') || active.status),
      });
      setActive(null);
      toast('Task saved');
      load();
    } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <div>
      <PageHeader title="Projects" text="Pick a project, then move cards across To do, In progress, and Done. Drag a card, or use the move buttons." action={<Button onClick={() => { setError(''); setOpenProject(true); }}>New project</Button>} />
      {error && !openProject && !active && !composer && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {projects.length === 0 ? <Empty title="No projects yet" text="Create a project for a client, then add tasks in the columns." /> : (
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-4">
          <aside className="mb-4 lg:sticky lg:top-4 lg:mb-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-secondary">Projects</p>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
              <button type="button" onClick={() => setProjectFilter('all')} className={`shrink-0 rounded-2xl border px-3 py-2 text-left text-sm font-semibold lg:flex lg:w-full lg:items-center lg:justify-between ${projectFilter === 'all' ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>
                <span>All work</span>
                <span className={`ml-3 text-xs lg:ml-0 ${projectFilter === 'all' ? 'text-neutral-300' : 'text-secondary'}`}>{tasks.length}</span>
              </button>
              {projects.map((project) => {
                const selected = projectFilter === project._id;
                return (
                  <button key={project._id} type="button" onClick={() => setProjectFilter(project._id)} className={`shrink-0 rounded-2xl border px-3 py-2 text-left lg:block lg:w-full ${selected ? 'border-black bg-black text-white' : 'border-line bg-card hover:bg-tint'}`}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{project.name}</span>
                      <span className={`text-xs ${selected ? 'text-neutral-300' : 'text-secondary'}`}>{project.taskCount || 0}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-[11px] ${selected ? 'text-neutral-300' : 'text-secondary'}`}>{project.clientId?.name || 'No client'}</span>
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="min-w-0">
            {selectedProject && (
              <div className="mb-3 rounded-3xl border border-line bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{selectedProject.name}</h2>
                    <p className="truncate text-sm text-secondary">{selectedProject.clientId?.name} · {selectedProject.status}</p>
                  </div>
                  <p className="text-sm font-semibold">{selectedProject.progress || 0}%</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-black" style={{ width: `${selectedProject.progress || 0}%` }} />
                </div>
              </div>
            )}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {QUICK_FILTERS.map((item) => (
                <button key={item.id} type="button" onClick={() => setQuickFilter(item.id)} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${quickFilter === item.id ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>{item.label}</button>
              ))}
            </div>
            <div className="mb-4 space-y-2">
              <TextInput className="w-full sm:max-w-xs" placeholder="Search task, client, project" value={search} onChange={(event) => setSearch(event.target.value)} />
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button type="button" onClick={() => setClientFilter('all')} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${clientFilter === 'all' ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>All clients</button>
                {clients.map((client) => (
                  <button key={client._id} type="button" onClick={() => setClientFilter(client._id)} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold ${clientFilter === client._id ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>{client.name}</button>
                ))}
              </div>
            </div>
            <p className="mb-3 text-sm text-secondary">{quickFilter === 'week_done' ? `${board.length} completed this week` : `${doneCount} of ${board.length} tasks done`}</p>
            <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
              {BOARD.map((column) => {
                const cards = board.filter((task) => taskInColumn(task, column.id));
                return (
                  <section
                    key={column.id}
                    className={`min-h-40 w-[min(85vw,22rem)] shrink-0 snap-start rounded-3xl border p-3 lg:w-auto lg:min-h-[420px] lg:shrink ${over === column.id ? 'border-black bg-tint' : 'border-line bg-[#F7F7F7]'}`}
                    onDragOver={(event) => { event.preventDefault(); if (over !== column.id) setOver(column.id); }}
                    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(''); }}
                    onDrop={(event) => { event.preventDefault(); const taskId = event.dataTransfer.getData('text/plain'); if (taskId) moveTask(taskId, column.id); }}
                  >
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div>
                        <p className="text-sm font-semibold">{column.label}</p>
                        <p className="text-[11px] text-secondary">{column.hint}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-secondary">{cards.length}</span>
                    </div>
                    <div className="space-y-2">
                      {cards.length === 0 && <p className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-xs text-secondary">Drop a card here</p>}
                      {cards.map((task) => (
                        <article
                          key={task._id}
                          draggable
                          onDragStart={(event) => { skipClick.current = true; event.dataTransfer.setData('text/plain', task._id); event.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnd={() => setOver('')}
                          onClick={() => { if (skipClick.current) { skipClick.current = false; return; } setActive(task); }}
                          className="cursor-grab rounded-2xl border border-line bg-card p-3 shadow-sm active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold">{task.title}</p>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Drag</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold">{taskClientName(task, projects)}</p>
                          <p className="truncate text-[11px] text-secondary">{projectOf(task, projects)?.name}</p>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-secondary">
                            <span className={task.priority === 'high' ? 'font-semibold text-ink' : ''}>{task.priority === 'high' ? 'High' : task.priority === 'low' ? 'Low' : 'Normal'}</span>
                            <span className={task.dueDate && task.dueDate < todayKey() && task.status !== 'Completed' ? 'font-semibold text-danger' : ''}>{task.dueDate || 'No date'}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {BOARD.filter((item) => item.id !== column.id).map((item) => (
                              <button key={item.id} type="button" className="min-h-11 rounded-full border border-line bg-bg px-3 py-2 text-xs font-semibold" onClick={(event) => { event.stopPropagation(); moveTask(task._id, item.id); }}>Move to {item.label}</button>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                    {composer === column.id ? (
                      <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); addTask(column.id); }}>
                        {projects.length > 1 && (
                          <Select value={projects.some((item) => item._id === addProjectId) ? addProjectId : projects[0]?._id} onChange={(event) => setAddProjectId(event.target.value)}>
                            {projects.map((item) => <option key={item._id} value={item._id}>{item.clientId?.name} · {item.name}</option>)}
                          </Select>
                        )}
                        {projects.length === 1 && <p className="text-xs text-secondary">{projects[0].clientId?.name} · {projects[0].name}</p>}
                        <TextInput autoFocus placeholder="Task name, then Enter" value={draft} onChange={(event) => setDraft(event.target.value)} />
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="submit" disabled={!draft.trim()}>Add card</Button>
                          <Button className="w-full" type="button" variant="ghost" onClick={() => { setComposer(null); setDraft(''); }}>Cancel</Button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" className="mt-3 w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold text-secondary hover:bg-white" onClick={() => openComposer(column.id)}>+ Add a card</button>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {openProject && <Modal title="New project" onClose={() => setOpenProject(false)}><form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => { try { await api.post('/projects', values); toast('Project created'); form.reset({ status: 'Planning', name: '', clientId: '', description: '', dueDate: '' }); setOpenProject(false); setError(''); load(); } catch (err) { setError(errorMessage(err)); } })}>
        <Field label="Client"><Select {...form.register('clientId', { required: true })}><option value="">Select a client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}</Select></Field>
        <Field label="Project name"><TextInput placeholder="Website redesign" {...form.register('name', { required: true })} /></Field>
        <Field label="Status"><Select {...form.register('status')}>{PROJECT_STATUSES.map((status) => <option key={status}>{status}</option>)}</Select></Field>
        <Field label="Due"><TextInput type="date" {...form.register('dueDate')} /></Field>
        <Field label="Description"><TextArea {...form.register('description')} /></Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit">Create project</Button>
      </form></Modal>}
      {active && <Modal title="Task" onClose={() => setActive(null)}><form className="grid gap-3" onSubmit={saveTask}>
        <p className="text-sm text-secondary">{taskClientName(active, projects)} · {projectOf(active, projects)?.name}</p>
        <Field label="Title"><TextInput name="title" defaultValue={active.title} required /></Field>
        <Field label="Details"><TextArea name="description" defaultValue={active.description || ''} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Move to"><Select name="status" defaultValue={active.status === 'Review' ? 'In Progress' : active.status}>{BOARD.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</Select></Field>
          <Field label="Priority"><Select name="priority" defaultValue={active.priority || 'normal'}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></Select></Field>
        </div>
        <Field label="Due"><TextInput type="date" name="dueDate" defaultValue={active.dueDate || ''} /></Field>
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="text-sm font-semibold text-danger" onClick={async () => { try { await api.delete(`/tasks/${active._id}`); setActive(null); toast('Task removed'); load(); } catch (err) { setError(errorMessage(err)); } }}>Delete</button>
          <Button type="submit">Save</Button>
        </div>
      </form></Modal>}
    </div>
  );
}

function paymentLabel(status: string) {
  if (status === 'partial') return 'Part paid';
  if (status === 'paid') return 'Paid';
  if (status === 'pending') return 'Pending';
  return titleCase(status);
}

function rupeeInput(paise: number) {
  return (Math.max(0, paise) / 100).toFixed(2);
}

function openReceipts(row: Row) {
  return (row.receipts || []).filter((receipt: Row) => !receipt.reversed);
}

function paymentDate(row: Row) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(row.dueDate || ''))) return String(row.dueDate);
  if (!row.createdAt) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.createdAt));
}

export function PaymentsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Row[]>([]);
  const [addingClient, setAddingClient] = useState(false);
  const [open, setOpen] = useState(false);
  const [editFor, setEditFor] = useState<Row | null>(null);
  const [editType, setEditType] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [receiptFor, setReceiptFor] = useState<Row | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<Row | null>(null);
  const [paidNow, setPaidNow] = useState('');
  const [payDate, setPayDate] = useState(todayKey());
  const [payBank, setPayBank] = useState('');
  const [view, setView] = useState('all');
  const [preset, setPreset] = useState('this_month');
  const [error, setError] = useState('');
  const key = useRef(idempotencyKey());
  const form = useForm<Record<string, string>>({ defaultValues: { clientId: '', paymentType: '', amount: '' } });
  useEffect(() => { form.register('clientId', { required: true }); }, [form]);
  const load = () => {
    api.get('/payments', { params: { limit: 100 } }).then(async (response) => {
      let data = response.data.data as Row[];
      const pages = Number(response.data.meta?.pages || 1);
      if (pages > 1) {
        const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api.get('/payments', { params: { limit: 100, page: index + 2 } })));
        data = data.concat(...rest.map((item) => item.data.data));
      }
      setRows(data);
    }).catch((err) => setError(errorMessage(err)));
    api.get('/banks').then((response) => setBanks(response.data.data)).catch(() => undefined);
  };
  const loadClients = () => api.get('/clients', { params: { limit: 100 } }).then((response) => setClients(response.data.data));
  useEffect(() => { load(); loadClients(); }, []);

  const transferBanks = banks.filter((bank) => bank.accountType !== 'cash' && bank.status !== 'inactive');
  const range = periodRange(preset);
  const periodRows = rows.filter((row) => {
    const date = paymentDate(row);
    return Boolean(date && date >= range.from && date <= range.to);
  });
  const visible = periodRows.filter((row) => {
    if (view === 'open') return row.status === 'pending' || row.status === 'partial' || row.status === 'overdue';
    if (view === 'paid') return row.status === 'paid';
    return row.status !== 'void';
  }).sort((a, b) => {
    const byDate = paymentDate(b).localeCompare(paymentDate(a));
    if (byDate) return byDate;
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
  const billedPaise = periodRows.reduce((sum, row) => sum + Number(row.invoiceAmountPaise || 0), 0);
  const receivedPaise = periodRows.reduce((sum, row) => sum + Number(row.amountReceivedPaise || 0), 0);
  const pendingOf = (row: Row) => row.invoiceAmountPaise - row.amountReceivedPaise;
  const closeReceipt = () => { setReceiptFor(null); setEditingReceipt(null); };

  const openReceive = (row: Row) => {
    setReceiptFor(row);
    setEditingReceipt(null);
    setPaidNow(rupeeInput(pendingOf(row)));
    setPayDate(todayKey());
    setPayBank('');
    setError('');
  };

  const openReceiptEdit = (row: Row, receipt: Row) => {
    setReceiptFor(row);
    setEditingReceipt(receipt);
    setPaidNow(rupeeInput(receipt.amountPaise));
    setPayDate(receipt.dateKey || todayKey());
    setPayBank(receipt.paymentMethod === 'bank_transfer' ? (receipt.bankAccountId?._id || receipt.bankAccountId || '') : '');
    setError('');
  };

  const saveReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (!receiptFor) return;
    const entered = Math.round(Number(paidNow) * 100);
    const room = pendingOf(receiptFor) + (editingReceipt?.amountPaise || 0);
    if (!paidNow || entered <= 0) { setError('Enter the amount received.'); return; }
    if (entered > room) { setError('That is more than the amount still pending.'); return; }
    const payload: Row = { amount: paidNow, date: payDate || todayKey(), paymentMethod: payBank ? 'bank_transfer' : 'cash' };
    if (payBank) payload.bankAccountId = payBank;
    try {
      if (editingReceipt) {
        await api.patch(`/payments/${receiptFor._id}/receipts/${editingReceipt._id}`, payload);
        toast('Received amount updated');
      } else {
        await api.post(`/payments/${receiptFor._id}/receipts`, { ...payload, idempotencyKey: key.current });
        toast(entered === pendingOf(receiptFor) ? 'Payment completed' : 'Part payment recorded');
        key.current = idempotencyKey();
      }
      closeReceipt();
      load();
    } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div>
      <PageHeader title="Client payments" text="The received amount is added to Company Cash, or to the bank you choose, and to Income." action={<Button onClick={() => { setError(''); setOpen(true); }}>Add payment</Button>} />
      <div className="mb-4 flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
        {PRESETS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setPreset(id)} className={`shrink-0 rounded-full border px-3 py-2 text-sm font-semibold ${preset === id ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>{label}</button>
        ))}
      </div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><p className="text-xs uppercase tracking-wider text-secondary">Billed</p><p className="mt-2 text-2xl font-semibold"><Money paise={billedPaise} /></p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-secondary">Received</p><p className="mt-2 text-2xl font-semibold"><Money paise={receivedPaise} /></p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-secondary">Pending</p><p className="mt-2 text-2xl font-semibold"><Money paise={billedPaise - receivedPaise} /></p></Card>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[['all', 'All'], ['open', 'Pending'], ['paid', 'Paid']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setView(id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${view === id ? 'border-black bg-black text-white' : 'border-line bg-white'}`}>{label}</button>
        ))}
      </div>
      {error && !receiptFor && !editFor && !open && <div className="mb-4"><ErrorText>{error}</ErrorText></div>}
      {visible.length === 0 ? <Empty title="No payments in this period" text="Try another period, or add what the client owes." /> : (
        <Table><thead><tr><Th>Client</Th><Th>Date</Th><Th>Type</Th><Th>Amount</Th><Th>Received</Th><Th>Pending</Th><Th>Status</Th><Th></Th></tr></thead><tbody>
          {visible.map((row) => <tr key={row._id}>
            <Td>{row.clientId?.name}</Td>
            <Td>{billDate(paymentDate(row)) || '—'}</Td>
            <Td>{row.paymentType}</Td>
            <Td><Money paise={row.invoiceAmountPaise} /></Td>
            <Td><Money paise={row.amountReceivedPaise} /></Td>
            <Td><Money paise={pendingOf(row)} /></Td>
            <Td><Badge tone={row.status === 'paid' ? 'success' : row.status === 'partial' ? 'neutral' : statusTone(row.status)}>{paymentLabel(row.status)}</Badge></Td>
            <Td><div className="flex justify-end gap-1">
              <Button variant="quiet" onClick={() => { setEditFor(row); setEditType(row.paymentType || ''); setEditAmount(rupeeInput(row.invoiceAmountPaise)); setError(''); }}>Edit</Button>
              {row.status !== 'paid' && row.status !== 'void' && <Button variant="quiet" onClick={() => openReceive(row)}>Receive</Button>}
            </div></Td>
          </tr>)}
        </tbody></Table>
      )}
      {open && !addingClient && <Modal title="Add payment" onClose={() => setOpen(false)}><form className="grid gap-3" onSubmit={form.handleSubmit(async (values) => { try { await api.post('/payments', { clientId: values.clientId, paymentType: values.paymentType, amount: values.amount }); toast('Payment added'); setOpen(false); form.reset(); load(); } catch (err) { setError(errorMessage(err)); } })}>
        <Field label="Client">
          <Select value={form.watch('clientId') || ''} onChange={(event) => { if (event.target.value === '__add__') { setAddingClient(true); return; } form.setValue('clientId', event.target.value, { shouldValidate: true }); }}>
            <option value="">Select a client</option>
            {clients.map((client) => <option key={client._id} value={client._id}>{client.name}</option>)}
            <option value="__add__">Add a client</option>
          </Select>
        </Field>
        <Field label="Type"><TextInput placeholder="Monthly, project, advance…" {...form.register('paymentType', { required: true })} /></Field>
        <Field label="Amount (INR)"><TextInput inputMode="decimal" placeholder="30000" {...form.register('amount', { required: true })} /></Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button type="submit">Save</Button>
      </form></Modal>}
      {addingClient && <ClientEditor client={null} onClose={() => setAddingClient(false)} onSaved={(saved) => { setAddingClient(false); if (saved?._id) { setClients((current) => [...current.filter((client) => client._id !== saved._id), saved].sort((a, b) => String(a.name).localeCompare(String(b.name)))); form.setValue('clientId', saved._id, { shouldValidate: true }); } else loadClients(); }} />}
      {editFor && <Modal title={`Edit ${editFor.clientId?.name || 'payment'}`} onClose={() => setEditFor(null)}>
        <form className="grid gap-3" onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api.patch(`/payments/${editFor._id}`, { paymentType: editType, amount: editAmount });
            toast('Payment updated');
            setEditFor(null);
            load();
          } catch (err) { setError(errorMessage(err)); }
        }}>
          <Field label="Type"><TextInput value={editType} onChange={(event) => setEditType(event.target.value)} required /></Field>
          <Field label="Amount (INR)"><TextInput inputMode="decimal" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} required /></Field>
          <p className="text-sm text-secondary">Already received <Money paise={editFor.amountReceivedPaise} />. The amount cannot go below that.</p>
          {openReceipts(editFor).length > 0 && (
            <div className="grid gap-2">
              <p className="text-xs uppercase tracking-wider text-secondary">Received</p>
              {openReceipts(editFor).map((receipt: Row) => (
                <div key={receipt._id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F7F7] px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold"><Money paise={receipt.amountPaise} /></p>
                    <p className="text-secondary">{receipt.bankAccountId?.accountName || 'Company Cash'} · {receipt.dateKey}</p>
                  </div>
                  <Button type="button" variant="quiet" onClick={() => { setEditFor(null); openReceiptEdit(editFor, receipt); }}>Edit</Button>
                </div>
              ))}
            </div>
          )}
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit">Save</Button>
        </form>
      </Modal>}
      {receiptFor && <Modal title={editingReceipt ? 'Edit received amount' : `Receive from ${receiptFor.clientId?.name || 'client'}`} onClose={closeReceipt}>
        <form className="grid gap-3" onSubmit={saveReceipt}>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F7F7F7] p-3 text-xs sm:text-sm">
            <div><p className="text-xs text-secondary">Amount</p><Money paise={receiptFor.invoiceAmountPaise} /></div>
            <div><p className="text-xs text-secondary">Received</p><Money paise={receiptFor.amountReceivedPaise} /></div>
            <div><p className="text-xs text-secondary">Pending</p><Money paise={pendingOf(receiptFor)} /></div>
          </div>
          <Field label="Amount"><TextInput inputMode="decimal" value={paidNow} onChange={(event) => setPaidNow(event.target.value)} /></Field>
          <Field label="Date"><TextInput type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} /></Field>
          <Field label="Add to">
            <Select value={payBank} onChange={(event) => setPayBank(event.target.value)}>
              <option value="">Company Cash</option>
              {transferBanks.map((bank) => <option key={bank._id} value={bank._id}>{bank.accountName} · {inr(bank.currentBalancePaise)}</option>)}
            </Select>
          </Field>
          <p className="text-sm text-secondary">Company Cash is already selected. Change it only if the money went into a bank. The amount is added to Income.</p>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit">{editingReceipt ? 'Save' : 'Record payment'}</Button>
        </form>
      </Modal>}
    </div>
  );
}

function billDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function billAmount(paise?: number) {
  return (Number(paise || 0) / 100).toFixed(2);
}

function invoiceDate(row: Row) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(row.dateKey || ''))) return String(row.dateKey);
  if (!row.createdAt) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(row.createdAt));
}

const removedInvoicesKey = 'dm-removed-invoices';

function removedInvoiceIds() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(removedInvoicesKey) || '[]');
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function rememberRemovedInvoice(id: string) {
  const ids = removedInvoiceIds();
  ids.add(String(id));
  sessionStorage.setItem(removedInvoicesKey, JSON.stringify([...ids]));
}

async function removeInvoice(row: Row) {
  try {
    await api.delete(`/invoices/${row._id}`);
    return;
  } catch (err) {
    if (errorMessage(err) !== 'Only a draft invoice can be deleted') throw err;
  }
  const response = await api.get(`/invoices/${row._id}`);
  const invoice = response.data?.data || row;
  const receipts = (invoice.receipts || []).filter((receipt: Row) => receipt.journalEntryId && !receipt.reversed);
  for (const receipt of receipts) {
    await api.post(`/ledger/journals/${receipt.journalEntryId}/reverse`, { reason: 'Deleted invoice', date: todayKey() });
  }
  if (invoice.journalEntryId) await api.post(`/invoices/${invoice._id}/void`, { reason: 'Deleted invoice' });
  rememberRemovedInvoice(invoice._id || row._id);
}

function priceText(paise?: number) {
  return (Number(paise || 0) / 100).toFixed(2);
}

function dueText(value?: string) {
  return billDate(value);
}

function typedDueDate(value: string) {
  const text = value.trim();
  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const iso = dayFirst
    ? `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
    : (/^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '');
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return '';
  return iso;
}

function InvoiceEditModal({ invoice, items, onClose, onSaved }: { invoice: Row; items?: Row[]; onClose: () => void; onSaved: () => void }) {
  const nextId = useRef(1);
  const lineFrom = (item?: Row) => {
    const id = nextId.current;
    nextId.current += 1;
    return { id, description: item?.description || '', price: item ? priceText(item.amountPaise) : '' };
  };
  const [lines, setLines] = useState(() => (items || []).map((item) => lineFrom(item)));
  const [dueDate, setDueDate] = useState(dueText(invoice.dueDate));
  const [status, setStatus] = useState(invoice.status === 'draft' ? 'draft' : 'sent');
  const [loading, setLoading] = useState(!items);
  const [error, setError] = useState('');
  const draft = status === 'draft';
  useEffect(() => {
    if (items) return;
    api.get(`/invoices/${invoice._id}`).then((response) => {
      setLines((response.data.items || []).map((item: Row) => lineFrom(item)));
      setDueDate(dueText(response.data.data?.dueDate));
      setStatus(response.data.data?.status === 'draft' ? 'draft' : 'sent');
    }).catch((err) => setError(errorMessage(err))).finally(() => setLoading(false));
  }, [invoice._id, items]);
  const kept = lines.filter((line) => line.description.trim() || line.price.trim());
  const total = kept.reduce((sum, line) => {
    const price = Number(line.price);
    return sum + (Number.isFinite(price) && price > 0 ? Math.round(price * 100) : 0);
  }, 0);
  return (
    <Modal title={`Edit ${invoice.number || 'invoice'}`} onClose={onClose}>
      {loading ? <Spinner /> : (
        <form className="grid gap-3" onSubmit={async (event) => {
          event.preventDefault();
          const due = typedDueDate(dueDate);
          const currentDraft = invoice.status === 'draft';
          if (draft && !due) {
            setError('Type the due date as DD/MM/YYYY.');
            return;
          }
          if (draft && (kept.length === 0 || kept.some((line) => !line.description.trim() || !/^\d+(\.\d{1,2})?$/.test(line.price) || Number(line.price) <= 0))) {
            setError('Enter the work and a price for each line.');
            return;
          }
          try {
            if (draft && !currentDraft) await api.patch(`/invoices/${invoice._id}/status`, { status: 'draft' });
            if (draft) {
              await api.patch(`/invoices/${invoice._id}`, {
                clientId: invoice.clientId?._id || invoice.clientId,
                date: invoice.dateKey,
                dueDate: due,
                incomeCategory: invoice.incomeCategory || 'Client Payments',
                discount: '0',
                taxPercent: '0',
                items: kept.map((line) => ({ description: line.description.trim(), quantity: '1', rate: line.price })),
              });
            }
            if (!draft && currentDraft) await api.post(`/invoices/${invoice._id}/issue`);
            onSaved();
          } catch (err) { setError(errorMessage(err)); }
        }}>
          <Field label="Status">
            <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
            </Select>
          </Field>
          <Field label="Due date">
            <TextInput value={dueDate} disabled={!draft} placeholder="DD/MM/YYYY" inputMode="numeric" aria-label="Due date" onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-secondary">Price</p>
              {draft && <Button type="button" variant="ghost" onClick={() => setLines((current) => [...current, lineFrom()])}>Add</Button>}
            </div>
            {lines.map((line, index) => (
              <div key={line.id} className="grid grid-cols-1 gap-2 border-b border-line pb-3 min-[480px]:grid-cols-[2rem_minmax(0,1fr)_6.5rem_auto] min-[480px]:items-center min-[480px]:border-0 min-[480px]:pb-0">
                <div className="flex min-w-0 items-center gap-2 min-[480px]:contents">
                  <span className="w-8 shrink-0 text-sm text-secondary">{String(index + 1).padStart(2, '0')}</span>
                  <TextInput value={line.description} disabled={!draft} placeholder="Work" aria-label={`Work ${index + 1}`} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, description: event.target.value } : item))} />
                </div>
                <div className="flex min-w-0 items-center gap-2 min-[480px]:contents">
                  <TextInput inputMode="decimal" value={line.price} disabled={!draft} placeholder="Price" aria-label={`Price ${index + 1}`} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, price: event.target.value } : item))} />
                  {draft && <Button type="button" variant="quiet" className="shrink-0" aria-label={`Remove line ${index + 1}`} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Remove</Button>}
                </div>
              </div>
            ))}
            <p className="text-right text-sm font-semibold">Total {billAmount(total)}</p>
            {!draft && <p className="text-sm text-secondary">Choose Draft to change the price and due date.</p>}
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit">Save</Button>
        </form>
      )}
    </Modal>
  );
}

function InvoiceSheet({ invoice, client, items }: { invoice: Row; client: Row; items: Row[] }) {
  const slots = Array.from({ length: Math.max(6, items.length) }, (_, index) => items[index]);
  return (
    <article className="-mx-3 overflow-hidden bg-[#e7ebf2] text-[#1c1c1c] sm:mx-auto sm:max-w-3xl sm:rounded-[28px] sm:shadow-card">
      <div className="bg-[linear-gradient(180deg,#050505_0%,#050505_46%,#102848_78%,#1a4d86_100%)] px-4 pb-20 pt-5 text-white sm:px-7 sm:pb-24 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0" aria-hidden="true">
              <circle cx="24" cy="24" r="22" fill="#111" />
              <path d="M24 2a22 22 0 0 1 0 44Z" fill="#fff" />
              <circle cx="24" cy="24" r="21" fill="none" stroke="#111" strokeWidth="1.5" />
            </svg>
            <p className="text-lg font-semibold leading-5">Dark<br />Media</p>
          </div>
          <p className="shrink-0 text-right text-xs sm:text-sm">www.darkmedia.tech</p>
        </div>
        <div className="mt-6 flex items-end justify-between gap-3 sm:mt-8">
          <div className="min-w-0">
            <p className="text-4xl font-light tracking-wide sm:text-5xl">INVOICE</p>
            <p className="mt-1 text-sm text-white/80">No. {invoice.number || 'Draft'}</p>
          </div>
          <p className="shrink-0 text-right text-sm leading-5">Date:<br />{billDate(invoice.dateKey)}</p>
        </div>
      </div>
      <div className="relative z-10 -mt-14 grid gap-3 px-3 sm:-mt-16 sm:grid-cols-2 sm:gap-4 sm:px-5">
        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-sm">Invoice To:</p>
          <p className="mt-1 text-xl font-semibold text-[#16345c]">{client.name}</p>
          <p className="mt-4 text-sm text-[#6b7280]">Phone: {client.phone || ''}</p>
          <p className="text-sm text-[#6b7280]">Email: {client.email || ''}</p>
          <p className="text-sm text-[#6b7280]">Website: {client.companyName || ''}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-sm">Payment Method:</p>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold">
            <span className="text-[#4285F4]">GPay</span>
            <span className="text-[#00BAF2]">Paytm</span>
            <span className="text-[#5f259f]">PhonePe</span>
          </p>
          <p className="mt-2 text-sm">9480889252</p>
          <p className="mt-4 text-sm">Due Date:</p>
          <p className="mt-1 min-h-7 rounded-md bg-[#d5dae2] px-2 py-1 text-sm">{billDate(invoice.dueDate)}</p>
        </div>
      </div>
      <div className="px-3 py-5 sm:px-5 sm:py-6">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-full bg-[#5BA4D6] px-3 py-2 text-xs font-semibold text-white sm:px-4">
            <span className="w-10 sm:w-14">No.</span>
            <span>DESCRIPTION</span>
          </div>
          <span className="shrink-0 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white sm:px-5">TOTAL</span>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {slots.map((item, index) => (
            <div key={item?._id || index} className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem] gap-2 sm:grid-cols-[3.5rem_minmax(0,1fr)_6.5rem]">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span className="min-w-0 break-words">{item?.description || ''}</span>
              <span className="text-right">{item ? billAmount(item.amountPaise) : ''}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <div className="flex w-full max-w-xs items-center justify-between gap-6 rounded-full bg-[#5BA4D6] px-4 py-2 text-white sm:w-auto sm:min-w-56 sm:px-5">
            <span className="text-sm font-semibold">TOTAL</span>
            <span className="font-semibold">{billAmount(invoice.totalPaise)}</span>
          </div>
        </div>
      </div>
      <div className="mx-3 mb-4 grid gap-4 rounded-3xl bg-white p-4 text-xs leading-5 text-[#6b7280] sm:mx-5 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="font-semibold text-[#1c1c1c]">Payment Terms</p>
          <p>Payment must be made as per the agreed terms.</p>
          <p>Advance payments are non-refundable once work begins.</p>
          <p>Extra work or revisions will be charged separately.</p>
        </div>
        <div className="sm:pt-5">
          <p>GST and third-party charges are additional, where applicable.</p>
          <p>Final files/project handover will be provided after full payment.</p>
          <p>Any invoice dispute must be raised within 7 days.</p>
        </div>
      </div>
      <p className="pb-6 text-center text-xs font-semibold tracking-[0.18em] text-[#9aa0a8]">THANK YOU FOR YOUR BUSINESS</p>
    </article>
  );
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState('this_month');
  const [statusFilter, setStatusFilter] = useState('');
  const [statusFor, setStatusFor] = useState<Row | null>(null);
  const [clients, setClients] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(todayKey());
  const [dueDate, setDueDate] = useState('');
  const [workId, setWorkId] = useState('');
  const [lines, setLines] = useState<Array<{ id: string; description: string; price: string }>>([]);
  const [error, setError] = useState('');
  const load = () => {
    api.get('/invoices', { params: { limit: 100 } }).then(async (response) => {
      let data = response.data.data as Row[];
      const pages = Number(response.data.meta?.pages || 1);
      if (pages > 1) {
        const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api.get('/invoices', { params: { limit: 100, page: index + 2 } })));
        data = data.concat(...rest.map((item) => item.data.data));
      }
      const removed = removedInvoiceIds();
      setRows(data.filter((row) => !removed.has(String(row._id))));
    }).catch((err) => setError(errorMessage(err)));
  };
  useEffect(() => {
    load();
    api.get('/clients', { params: { limit: 100 } }).then((response) => setClients(response.data.data || []));
  }, []);
  useEffect(() => {
    if (!clientId) {
      setProjects([]);
      setTasks([]);
      return;
    }
    api.get('/projects', { params: { clientId } }).then((response) => setProjects(response.data.data || [])).catch(() => setProjects([]));
    api.get('/tasks', { params: { clientId } }).then((response) => setTasks(response.data.data || [])).catch(() => setTasks([]));
  }, [clientId]);

  const client = clients.find((item) => item._id === clientId);
  const monthWorks = (() => {
    if (!clientId) return [];
    const options = [
      ...projects.map((project) => ({ id: `project:${project._id}`, label: project.name, price: '' })),
      ...tasks.map((task) => ({ id: `task:${task._id}`, label: task.title, price: '' })),
    ];
    if (client?.service) {
      const price = client.serviceType === 'monthly_subscription' && client.monthlyAmountPaise ? (Number(client.monthlyAmountPaise) / 100).toFixed(2) : '';
      options.unshift({ id: `service:${client._id}`, label: client.service, price });
    }
    return options.filter((option, index, list) => list.findIndex((item) => item.label === option.label) === index);
  })();
  const totalPaise = lines.reduce((sum, line) => {
    const price = Number(line.price);
    return sum + (Number.isFinite(price) ? Math.round(price * 100) : 0);
  }, 0);

  const range = periodRange(preset);
  const visible = rows.filter((row) => {
    const date = invoiceDate(row);
    if (!date || date < range.from || date > range.to) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    return true;
  });

  function addWork(id: string) {
    const work = monthWorks.find((item) => item.id === id);
    if (!work || lines.some((line) => line.id === work.id)) return;
    setLines((current) => [...current, { id: work.id, description: work.label, price: work.price }]);
    setWorkId('');
  }

  return (
    <div>
      <PageHeader title="Invoices" text="Choose a client, select this month’s work, add the price, and generate the invoice." action={<Button onClick={() => { setError(''); setOpen(true); }}>New invoice</Button>} />
      <div className="mb-4 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select className="w-full sm:max-w-[160px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Invoice status">
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
        </Select>
        <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1">
          {PRESETS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPreset(id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${preset === id ? 'border-black bg-black text-white' : 'border-line bg-card'}`}>{label}</button>
          ))}
        </div>
      </div>
      {error && !open && !statusFor && <ErrorText>{error}</ErrorText>}
      {visible.length === 0 ? <Empty title={statusFilter === 'draft' ? 'No draft invoices' : statusFilter === 'sent' ? 'No sent invoices' : 'No invoices in this period'} text="Try another status or period, or generate an invoice." /> : (
      <Table><thead><tr><Th>Number</Th><Th>Client</Th><Th>Total</Th><Th>Balance</Th><Th>Status</Th><Th></Th></tr></thead><tbody>
        {visible.map((row) => <tr key={row._id}><Td><Link to={`/invoices/${row._id}`}>{row.number || 'Draft'}</Link></Td><Td>{row.clientId?.name}</Td><Td><Money paise={row.totalPaise} /></Td><Td><Money paise={row.totalPaise - row.amountPaidPaise} /></Td><Td><Badge tone={statusTone(row.status)}>{titleCase(row.status)}</Badge></Td><Td><span className="flex justify-end gap-1"><Button variant="quiet" onClick={() => { setStatusFor(row); setError(''); }}>Edit</Button><Button variant="quiet" onClick={async () => { try { await removeInvoice(row); toast('Invoice deleted'); load(); } catch (err) { setError(errorMessage(err)); } }}>Delete</Button></span></Td></tr>)}
      </tbody></Table>
      )}
      {open && <Modal title="Generate invoice" onClose={() => setOpen(false)}>
        <form className="grid gap-3" onSubmit={async (event) => {
          event.preventDefault();
          const items = lines.filter((line) => line.description.trim() && Number(line.price) > 0).map((line) => ({ description: line.description.trim(), quantity: '1', rate: line.price }));
          if (!clientId || items.length === 0) {
            setError('Select a client, this month’s work, and a price for each line.');
            return;
          }
          try {
            const response = await api.post('/invoices', {
              clientId,
              date,
              dueDate: dueDate || date,
              incomeCategory: 'Client Payments',
              discount: '0',
              taxPercent: '0',
              items,
            });
            setOpen(false);
            navigate(`/invoices/${response.data.data._id}`);
          } catch (err) { setError(errorMessage(err)); }
        }}>
          <Field label="Client">
            <Select value={clientId} onChange={(event) => { setClientId(event.target.value); setLines([]); setWorkId(''); }}>
              <option value="">Select a client</option>
              {clients.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="This month’s work">
            <Select value={workId} onChange={(event) => addWork(event.target.value)} disabled={!clientId}>
              <option value="">{clientId ? 'Select work' : 'Select a client first'}</option>
              {monthWorks.map((work) => <option key={work.id} value={work.id}>{work.label}{work.price ? ` · ${work.price}` : ''}</option>)}
            </Select>
          </Field>
          {clientId && projects.length === 0 && tasks.length === 0 && <p className="text-sm text-secondary">No projects for this client.</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-secondary">Lines</p>
            <Button type="button" variant="ghost" onClick={() => setLines((current) => [...current, { id: `custom-${Date.now()}`, description: '', price: '' }])}>Add</Button>
          </div>
          {lines.map((line, index) => (
            <div key={line.id} className="grid grid-cols-1 gap-2 border-b border-line pb-3 min-[480px]:grid-cols-[2rem_minmax(0,1fr)_6.5rem_auto] min-[480px]:items-center min-[480px]:border-0 min-[480px]:pb-0">
              <div className="flex min-w-0 items-center gap-2 min-[480px]:contents">
                <span className="w-8 shrink-0 text-sm text-secondary">{String(index + 1).padStart(2, '0')}</span>
                <TextInput value={line.description} placeholder="Work" aria-label={`Work ${index + 1}`} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, description: event.target.value } : item))} />
              </div>
              <div className="flex min-w-0 items-center gap-2 min-[480px]:contents">
                <TextInput inputMode="decimal" placeholder="Price" value={line.price} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, price: event.target.value } : item))} aria-label={`Price ${index + 1}`} />
                <Button type="button" variant="quiet" className="shrink-0" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Remove</Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-2xl bg-[#e8f3fb] px-4 py-3">
            <span className="text-sm font-semibold text-[#2f6f9f]">Total</span>
            <span className="text-lg font-semibold">{billAmount(totalPaise)}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date"><TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
            <Field label="Due date"><TextInput type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit">Generate invoice</Button>
        </form>
      </Modal>}
      {statusFor && <InvoiceEditModal invoice={statusFor} onClose={() => setStatusFor(null)} onSaved={() => { setStatusFor(null); load(); }} />}
    </div>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Row | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const load = () => api.get(`/invoices/${id}`).then((response) => setData(response.data));
  useEffect(() => {
    if (id && removedInvoiceIds().has(String(id))) {
      navigate('/invoices', { replace: true });
      return;
    }
    load();
  }, [id]);
  if (!data) return <Spinner />;
  const invoice = data.data;
  const client = invoice.clientId || {};
  const items = data.items || [];
  return (
    <div>
      <PageHeader title={invoice.number || 'Draft invoice'} text={client.name} action={
        <>
          <Button variant="ghost" onClick={() => navigate('/invoices')}>Back</Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" onClick={() => downloadInvoicePdf({ number: invoice.number, date: invoice.dateKey, dueDate: invoice.dueDate, totalPaise: invoice.totalPaise, clientName: client.name, phone: client.phone, email: client.email, website: client.companyName, items })}>Download PDF</Button>
          <Button variant="danger" onClick={async () => { try { await removeInvoice(invoice); navigate('/invoices'); } catch (err) { setError(errorMessage(err)); } }}>Delete</Button>
        </>
      } />
      {error && <ErrorText>{error}</ErrorText>}
      <InvoiceSheet invoice={invoice} client={client} items={items} />
      {editing && <InvoiceEditModal invoice={invoice} items={items} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}

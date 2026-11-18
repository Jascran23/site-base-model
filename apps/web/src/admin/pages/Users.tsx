import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';

interface Permission { key: string; label: string; group_name?: string; group: string }
interface UserRow { id: number; name: string; email: string; role: 'master' | 'client_admin'; is_active: number; permissions: string[] }

export function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([
        api<{ users: UserRow[] }>('/users'),
        api<{ permissions: Permission[] }>('/users/permissions'),
      ]);
      setUsers(u.users); setPerms(p.permissions);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao carregar.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleActive(u: UserRow) {
    await api(`/users/${u.id}`, { method: 'PATCH', body: { is_active: !u.is_active } }).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuários</h1>
        <button className="btn-primary" onClick={() => setEditing('new')}>Novo administrador</button>
      </div>
      {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="panel divide-y divide-ink-100">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{u.name} {!u.is_active && <span className="text-sm font-normal text-red-700">(desativado)</span>}</p>
              <p className="text-sm text-ink-500">{u.email} · {u.role === 'master' ? 'Desenvolvedor' : `${u.permissions.length} permissões`}</p>
            </div>
            {u.role !== 'master' && (
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => setEditing(u)}>Editar permissões</button>
                <button className="btn-ghost" onClick={() => toggleActive(u)}>{u.is_active ? 'Desativar' : 'Reativar'}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <UserForm user={editing === 'new' ? null : editing} perms={perms}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function UserForm({ user, perms, onClose, onSaved }: { user: UserRow | null; perms: Permission[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(user?.permissions ?? []));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of perms) map.set(p.group ?? p.group_name ?? 'Outros', [...(map.get(p.group ?? p.group_name ?? 'Outros') ?? []), p]);
    return [...map.entries()];
  }, [perms]);

  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const permissions = [...selected];
      if (user) await api(`/users/${user.id}`, { method: 'PATCH', body: { name, permissions, ...(password ? { password } : {}) } });
      else await api('/users', { method: 'POST', body: { name, email, password, permissions } });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError && err.fields?.length ? err.fields.map((f) => f.message).join(' ') : err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4">
      <form onSubmit={submit} className="panel my-8 w-full max-w-lg space-y-4 p-6">
        <h2 className="text-lg font-semibold">{user ? 'Editar administrador' : 'Novo administrador'}</h2>
        <div><label className="label" htmlFor="u-name">Nome</label><input id="u-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        {!user && <div><label className="label" htmlFor="u-email">E-mail</label><input id="u-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>}
        <div>
          <label className="label" htmlFor="u-pass">{user ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</label>
          <input id="u-pass" type="password" autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required={!user} />
          <p className="mt-1 text-xs text-ink-500">Mínimo de 10 caracteres, com letras e números.</p>
        </div>
        <fieldset className="space-y-3">
          <legend className="label">O que este usuário pode fazer</legend>
          {groups.map(([group, list]) => (
            <div key={group}>
              <p className="text-sm font-medium text-ink-700">{group}</p>
              {list.map((p) => (
                <label key={p.key} className="flex items-center gap-2 py-0.5 text-sm">
                  <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} /> {p.label}
                </label>
              ))}
            </div>
          ))}
        </fieldset>
        {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  );
}

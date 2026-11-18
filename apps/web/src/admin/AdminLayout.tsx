import { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { FileText, Image, LayoutDashboard, LogOut, Menu, Palette, Search, Settings, Shapes, Users, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../lib/auth';

interface NavItem { to: string; label: string; icon: LucideIcon; perms?: string[]; end?: boolean }

// Cada item só aparece se o usuário tiver ao menos uma das permissões (o back-end valida de qualquer forma).
const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/paginas', label: 'Páginas', icon: FileText, perms: ['pages.view'] },
  { to: '/admin/imagens', label: 'Biblioteca de imagens', icon: Image, perms: ['media.view', 'media.select'] },
  { to: '/admin/aparencia', label: 'Aparência', icon: Palette, perms: ['theme.edit'] },
  { to: '/admin/modelos', label: 'Modelos', icon: Shapes, perms: ['templates.manage'] },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users, perms: ['users.manage'] },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings, perms: ['settings.business', 'settings.technical'] },
  { to: '/admin/seo', label: 'SEO', icon: Search, perms: ['seo.edit'] },
];

export function AdminLayout() {
  const { user, loading, can, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <p className="p-8 text-ink-500">Carregando…</p>;
  if (!user) return <Navigate to="/admin/login" replace />;

  const items = NAV.filter((i) => !i.perms || i.perms.some(can));

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink-900 text-ink-100" aria-label="Menu principal">
      <div className="px-5 py-5 text-lg font-semibold text-white">Painel do site</div>
      <ul className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-ink-700 text-white' : 'text-ink-300 hover:bg-ink-800'}`}>
              <Icon size={18} aria-hidden /> {label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="border-t border-ink-700 p-4 text-sm">
        <p className="truncate text-white">{user.name}</p>
        <p className="truncate text-ink-300">{user.role === 'master' ? 'Desenvolvedor' : 'Administrador'}</p>
        <button onClick={logout} className="mt-3 flex items-center gap-2 text-ink-300 hover:text-white"><LogOut size={16} aria-hidden /> Sair</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden lg:block">{sidebar}</aside>
      <header className="flex items-center justify-between bg-ink-900 px-4 py-3 text-white lg:hidden">
        <span className="font-semibold">Painel do site</span>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="absolute right-3 top-4 z-10 text-white"><X /></button>
            {sidebar}
          </div>
        </div>
      )}
      <main className="p-4 sm:p-8"><Outlet /></main>
    </div>
  );
}

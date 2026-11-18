import { Link } from 'react-router-dom';

// Placeholder. A Etapa 8 renderiza as páginas publicadas a partir do banco (registry de seções).
export function PublicHome() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Site em instalação</h1>
      <p className="mt-2 text-ink-500">O conteúdo será exibido aqui quando a primeira página for publicada.</p>
      <Link className="btn-primary mt-6" to="/admin">Acessar o painel</Link>
    </main>
  );
}

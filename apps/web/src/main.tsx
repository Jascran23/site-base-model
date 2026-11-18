import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './lib/auth';
import { AdminLayout } from './admin/AdminLayout';
import { Login } from './admin/pages/Login';
import { Dashboard } from './admin/pages/Dashboard';
import { Users } from './admin/pages/Users';
import { Media } from './admin/pages/Media';
import { ComingSoon } from './admin/pages/ComingSoon';
import { PublicHome } from './public/PublicHome';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="paginas" element={<ComingSoon title="Páginas" stage="Etapa 5" />} />
            <Route path="imagens" element={<Media />} />
            <Route path="aparencia" element={<ComingSoon title="Aparência" stage="Etapa 7" />} />
            <Route path="modelos" element={<ComingSoon title="Modelos" stage="Etapa 5" />} />
            <Route path="usuarios" element={<Users />} />
            <Route path="configuracoes" element={<ComingSoon title="Configurações" stage="Etapa 9" />} />
            <Route path="seo" element={<ComingSoon title="SEO" stage="Etapa 9" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

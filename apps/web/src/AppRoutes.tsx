import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { api } from './lib/api';
import { AdminLayout } from './admin/AdminLayout';
import { Login } from './admin/pages/Login';
import { Dashboard } from './admin/pages/Dashboard';
import { Users } from './admin/pages/Users';
import { Media } from './admin/pages/Media';
import { Pages } from './admin/pages/Pages';
import { PageSettings } from './admin/pages/PageSettings';
import { PagePreview } from './admin/pages/PagePreview';
import { Templates } from './admin/pages/Templates';
import { Appearance } from './admin/pages/Appearance';
import { Settings } from './admin/pages/Settings';
import { Seo } from './admin/pages/Seo';
import { Forms } from './admin/pages/Forms';
import { PublicNotFound, PublicPage, type PublicPageData } from './public/PublicPage';

export type InitialPublicRender = {kind:'page';data:PublicPageData}|{kind:'not-found'}|null;

function PublicRoute({initial,home=false}:{initial:InitialPublicRender;home?:boolean}){
  const {slug}=useParams();const matches=initial?.kind==='not-found'||initial?.kind==='page'&&(home?initial.data.page.is_home===1:initial.data.page.slug===slug);
  const [result,setResult]=useState<InitialPublicRender>(matches?initial:null);const [loading,setLoading]=useState(!matches);
  useEffect(()=>{
    if(matches)return;let active=true;setLoading(true);
    const endpoint=home?'/public/home':`/public/pages/${encodeURIComponent(slug??'')}`;
    api<PublicPageData>(endpoint).then((data)=>{if(active)setResult({kind:'page',data});}).catch(()=>{if(active)setResult({kind:'not-found'});}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[home,matches,slug]);
  if(loading)return <main className="p-8" aria-live="polite">Carregando página…</main>;
  if(result?.kind==='page')return <PublicPage data={result.data}/>;
  return <PublicNotFound/>;
}

export function AppRoutes({initialPublicRender=null}:{initialPublicRender?:InitialPublicRender}){
  return <AuthProvider><Routes>
    <Route path="/" element={<PublicRoute initial={initialPublicRender} home/>}/>
    <Route path="/admin/login" element={<Login/>}/>
    <Route path="/admin" element={<AdminLayout/>}>
      <Route index element={<Dashboard/>}/><Route path="paginas" element={<Pages/>}/><Route path="paginas/:id" element={<PageSettings/>}/>
      <Route path="preview/:token" element={<PagePreview/>}/><Route path="imagens" element={<Media/>}/><Route path="aparencia" element={<Appearance/>}/>
      <Route path="modelos" element={<Templates/>}/><Route path="usuarios" element={<Users/>}/><Route path="formularios" element={<Forms/>}/>
      <Route path="configuracoes" element={<Settings/>}/><Route path="seo" element={<Seo/>}/>
    </Route>
    <Route path="/:slug" element={<PublicRoute initial={initialPublicRender}/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></AuthProvider>;
}

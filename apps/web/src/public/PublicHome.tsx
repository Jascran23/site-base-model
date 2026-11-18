import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_THEME, themeToCssVars, type ThemeTokens } from '@cms/shared';
import { api } from '../lib/api';

export function PublicHome() {
  const [theme,setTheme]=useState<ThemeTokens>(DEFAULT_THEME);const [logo,setLogo]=useState('');
  useEffect(()=>{api<{tokens:ThemeTokens;logoUrl:string|null;faviconUrl:string|null}>('/theme/public').then(({tokens,logoUrl,faviconUrl})=>{setTheme(tokens);if(logoUrl)setLogo(logoUrl);if(faviconUrl){let link=document.querySelector<HTMLLinkElement>('link[rel="icon"]');if(!link){link=document.createElement('link');link.rel='icon';document.head.append(link);}link.href=faviconUrl;}}).catch(()=>undefined);},[]);
  const css=themeToCssVars(theme) as CSSProperties;
  return (
    <main className="min-h-screen p-8" style={{...css,backgroundColor:theme.colors.background,color:theme.colors.text,fontFamily:theme.typography.bodyFont,fontSize:theme.typography.baseSize}}>
      <div className="mx-auto max-w-4xl"><header className="flex min-h-16 items-center">{logo?<img src={logo} alt="Logotipo" className="max-h-16 max-w-48 object-contain"/>:<span className="font-semibold" style={{color:theme.colors.primary}}>Seu site</span>}</header>
      <section className="mt-10 p-8" style={{backgroundColor:theme.colors.surface,borderRadius:theme.radius.lg,boxShadow:theme.shadow.md}}><h1 className="text-2xl font-semibold" style={{fontFamily:theme.typography.headingFont,color:theme.colors.primary}}>Site em instalação</h1>
      <p className="mt-2" style={{color:theme.colors.textMuted}}>O conteúdo será exibido aqui quando uma página for publicada.</p>
      <Link className="mt-6 inline-flex px-4 py-2 text-sm font-medium" style={{backgroundColor:theme.button.style==='solid'?theme.colors.primary:'transparent',border:`1px solid ${theme.colors.primary}`,borderRadius:theme.button.radius,color:theme.button.style==='solid'?'#ffffff':theme.colors.primary}} to="/admin">Acessar o painel</Link></section></div>
    </main>
  );
}

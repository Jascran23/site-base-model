import type { PageDraft, SectionInstance } from '@cms/shared';
import { useState, type FormEvent } from 'react';
import type { FormField } from '@cms/shared';
import { api } from '../lib/api';

export interface PublicMediaMeta { width:number; height:number; thumbUrl:string; alt:string }
export function SectionRenderer({ section, mediaUrls = {}, mediaMeta = {}, contactForm }: { section: SectionInstance; mediaUrls?: Record<number, string>; mediaMeta?:Record<number,PublicMediaMeta>; contactForm?:{id:number;name:string;fields:FormField[];successMessage:string} }) {
  if (section.hidden) return null;
  const p = section.props;
  const imageId=typeof p.imageId==='number'?p.imageId:null;const image=imageId!==null?mediaUrls[imageId]:undefined;const meta=imageId!==null?mediaMeta[imageId]:undefined;
  const imageProps=meta?{width:meta.width,height:meta.height,alt:meta.alt,srcSet:`${meta.thumbUrl} 400w, ${image} ${meta.width}w`,sizes:'(max-width: 768px) 100vw, 50vw'}:{alt:''};
  const wrap = 'px-6 py-12 md:px-12';
  const sectionStyle={backgroundColor:String(p.backgroundColor),color:'var(--color-text)'};
  const headingStyle={fontFamily:'var(--font-heading)',color:'var(--color-primary)'};
  const buttonStyle={borderRadius:'var(--button-radius)',backgroundColor:'var(--color-primary)',color:'#fff'};
  if (section.type === 'hero') return <section className={`${wrap} grid gap-8 md:grid-cols-2`} style={sectionStyle}><div><p className="text-sm uppercase tracking-widest" style={{color:'var(--color-secondary)'}}>{String(p.eyebrow)}</p><h1 className="mt-3 text-4xl font-bold" style={headingStyle}>{String(p.title)}</h1><p className="mt-4 whitespace-pre-wrap">{String(p.body)}</p><a className="mt-6 inline-block px-5 py-3" style={buttonStyle} href={String((p.primaryButton as {url:string}).url)}>{String((p.primaryButton as {label:string}).label)}</a></div>{image && <img src={image} {...imageProps} loading="lazy" className="max-h-96 w-full rounded-xl object-cover" />}</section>;
  if (section.type === 'about') return <section className={`${wrap} grid gap-8 md:grid-cols-2`} style={sectionStyle}><div><p className="text-sm uppercase tracking-widest" style={{color:'var(--color-secondary)'}}>{String(p.eyebrow)}</p><h2 className="mt-2 text-3xl font-bold" style={headingStyle}>{String(p.title)}</h2><p className="mt-4 whitespace-pre-wrap">{String(p.body)}</p><ul className="mt-5 space-y-3">{(p.highlights as {title:string;description:string}[]).map((x,i)=><li key={i}><strong>{x.title}</strong><p>{x.description}</p></li>)}</ul></div>{image && <img src={image} {...imageProps} loading="lazy" className="max-h-96 w-full rounded-xl object-cover" />}</section>;
  if (section.type === 'services') return <section className={wrap} style={sectionStyle}><p className="text-sm uppercase tracking-widest" style={{color:'var(--color-secondary)'}}>{String(p.eyebrow)}</p><h2 className="mt-2 text-3xl font-bold" style={headingStyle}>{String(p.title)}</h2><p className="mt-3">{String(p.intro)}</p><div className="mt-6 grid gap-4 md:grid-cols-3">{(p.items as {title:string;description:string}[]).map((x,i)=><article key={i} className="rounded-xl p-5" style={{backgroundColor:'var(--color-surface)',borderRadius:'var(--radius-md)',boxShadow:'var(--shadow-sm)'}}><h3 className="font-semibold" style={headingStyle}>{x.title}</h3><p className="mt-2">{x.description}</p></article>)}</div></section>;
  if (section.type === 'contact') return <section className={`${wrap} text-center`} style={sectionStyle}><p className="text-sm uppercase tracking-widest" style={{color:'var(--color-secondary)'}}>{String(p.eyebrow)}</p><h2 className="mt-2 text-3xl font-bold" style={headingStyle}>{String(p.title)}</h2><p className="mt-3">{String(p.body)}</p>{contactForm?<ContactForm form={contactForm}/>:<a className="mt-6 inline-block px-5 py-3" style={buttonStyle} href={String((p.button as {url:string}).url)}>{String((p.button as {label:string}).label)}</a>}</section>;
  return null;
}

export function SectionPreview({ content, mediaUrls = {}, mediaMeta = {} }: { content: PageDraft; mediaUrls?: Record<number,string>; mediaMeta?:Record<number,PublicMediaMeta> }) { return <div className="overflow-hidden rounded-xl border bg-white text-slate-800">{content.sections.map((section)=><SectionRenderer key={section.id} section={section} mediaUrls={mediaUrls} mediaMeta={mediaMeta} />)}</div>; }

function ContactForm({form}:{form:{id:number;name:string;fields:FormField[];successMessage:string}}){
  const [message,setMessage]=useState('');const [sending,setSending]=useState(false);const [done,setDone]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const formElement=event.currentTarget;setSending(true);setMessage('');const values=new FormData(formElement);const fields=Object.fromEntries(form.fields.map((field)=>[field.name,String(values.get(field.name)??'')]));const website=String(values.get('website')??'');
    try{const result=await api<{message:string}>(`/public/forms/${form.id}/submit`,{method:'POST',body:{fields,consent:values.get('consent')==='on',website}});setMessage(result.message||form.successMessage);setDone(true);formElement.reset();}
    catch(error){setMessage(error instanceof Error?error.message:'Não foi possível enviar sua mensagem. Tente novamente.');}finally{setSending(false);}}
  return <form onSubmit={submit} className="mx-auto mt-6 max-w-xl space-y-3 text-left" aria-label={form.name}>
    {form.fields.map((field)=><label key={field.name} className="block"><span className="mb-1 block text-sm font-medium">{field.label}{field.required?' *':''}</span>{field.type==='textarea'?<textarea className="w-full rounded border border-slate-300 bg-white p-3 text-slate-900" name={field.name} maxLength={field.maxLength} required={field.required}/>:<input className="w-full rounded border border-slate-300 bg-white p-3 text-slate-900" type={field.type==='tel'?'tel':field.type} name={field.name} maxLength={field.maxLength} required={field.required}/>}</label>)}
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden"><label>Não preencha este campo<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
    <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" name="consent" required/><span>Concordo com o uso dos dados enviados para retorno deste contato.</span></label>
    {message&&<p role={done?'status':'alert'} className="text-sm">{message}</p>}
    <button className="px-5 py-3 font-medium" style={{borderRadius:'var(--button-radius)',backgroundColor:'var(--color-primary)',color:'#fff'}} disabled={sending}>{sending?'Enviando…':'Enviar mensagem'}</button>
  </form>;
}

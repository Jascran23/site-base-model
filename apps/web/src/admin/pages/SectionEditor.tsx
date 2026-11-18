import { useEffect, useRef, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react';
import { getSectionDefinition, sectionRegistry, type FieldDescriptor, type PageDraft, type SectionInstance } from '@cms/shared';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { MediaPicker, type MediaItem } from '../MediaPicker';
import { SectionPreview } from '../../public/sections';

function newSection(type: string): SectionInstance {
  const def = getSectionDefinition(type)!;
  return { id: crypto.randomUUID(), type, schemaVersion: def.schemaVersion, props: structuredClone(def.defaultProps) };
}
function SortableRow({ section, selected, canStructure, onSelect, onRemove, onDuplicate, onToggle }: { section: SectionInstance; selected: boolean; canStructure: boolean; onSelect: () => void; onRemove: () => void; onDuplicate: () => void; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return <div ref={setNodeRef} style={style} className={`flex items-center gap-1 rounded-md border p-2 ${selected ? 'border-brand-600 bg-brand-soft' : 'border-ink-100'}`}>{canStructure&&<button className="cursor-grab p-1" {...attributes} {...listeners} aria-label="Reordenar"><GripVertical size={16}/></button>}<button className="min-w-0 flex-1 truncate text-left text-sm" onClick={onSelect}>{getSectionDefinition(section.type)?.label}</button>{canStructure&&<><button className="p-1" title={section.hidden ? 'Mostrar' : 'Ocultar'} onClick={onToggle}>{section.hidden ? <EyeOff size={15}/> : <Eye size={15}/>}</button><button className="p-1" title="Duplicar" onClick={onDuplicate}><Copy size={15}/></button><button className="p-1 text-red-700" title="Remover" onClick={onRemove}><Trash2 size={15}/></button></>}</div>;
}

export function SectionEditor({ initial, versionId, pageId, canStructure }: { initial: PageDraft; versionId: number; pageId: number; canStructure: boolean }) {
  const { can, user } = useAuth();
  const isMaster = user?.role === 'master';
  const [content, setContent] = useState(initial);
  const [selected, setSelected] = useState(initial.sections[0]?.id ?? '');
  const [media, setMedia] = useState<Record<number, string>>({});
  const [picker, setPicker] = useState<{open:boolean; target: string}>({ open: false, target: '' });
  const [status, setStatus] = useState('Salvo');
  const [preview, setPreview] = useState(false);
  const baseId = useRef(versionId); const timer = useRef<number>(); const busy = useRef(false); const dirty = useRef(false); const current = useRef(content); const saveRef = useRef<()=>void>();
  current.current=content;
  useEffect(() => { setContent(initial); baseId.current = versionId; }, [initial, versionId]);
  useEffect(() => {
    if (!dirty.current) return;
    window.clearTimeout(timer.current); setStatus('Alterações pendentes');
    const save = async () => {
      if (busy.current) return;
      busy.current = true; const snapshot=content; setStatus('Salvando…');
      try { const result = await api<{versionId:number}>(`/pages/${pageId}/draft`, { method:'PUT', body:{ baseVersionId:baseId.current, content:snapshot } }); baseId.current=result.versionId; dirty.current=JSON.stringify(snapshot)!==JSON.stringify(current.current); if(!dirty.current)setStatus('Salvo'); }
      catch (e) { setStatus(e instanceof ApiError && e.status===409 ? 'Conflito: recarregue a página para continuar.' : e instanceof Error ? e.message : 'Falha ao salvar.'); }
      finally { busy.current=false; if(dirty.current)timer.current=window.setTimeout(()=>saveRef.current?.(),300); }
    };
    saveRef.current=save;
    timer.current = window.setTimeout(save, 650);
    return () => window.clearTimeout(timer.current);
  }, [content, pageId]);
  const selectedSection = content.sections.find((x)=>x.id===selected);
  function update(sectionId: string, key: string, value: unknown) { dirty.current=true; setContent((old)=>({...old,sections:old.sections.map((s)=>s.id===sectionId?{...s,props:{...s.props,[key]:value}}:s)})); }
  function field(section: SectionInstance, descriptor: FieldDescriptor) {
    const value=section.props[descriptor.name]; const updateValue=(v:unknown)=>update(section.id,descriptor.name,v);
    if (descriptor.type==='text'||descriptor.type==='textarea'||descriptor.type==='color') return <label key={descriptor.name} className="block"><span className="label">{descriptor.label}</span>{descriptor.type==='textarea'?<textarea className="input min-h-20" maxLength={descriptor.maxLength} value={String(value??'')} onChange={(e)=>updateValue(e.target.value)}/>:<input className="input" type={descriptor.type==='color'?'color':descriptor.name==='contactEmail'?'email':'text'} maxLength={descriptor.maxLength} value={String(value??(descriptor.type==='color'?'#ffffff':''))} onChange={(e)=>updateValue(descriptor.name==='contactEmail'?(e.target.value||null):e.target.value)}/>}</label>;
    if (descriptor.type==='toggle') return <label key={descriptor.name} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={(e)=>updateValue(e.target.checked)}/>{descriptor.label}</label>;
    if (descriptor.type==='image') return <div key={descriptor.name}><span className="label">{descriptor.label}</span>{can('media.select')?<><button className="btn-ghost" type="button" onClick={()=>setPicker({open:true,target:section.id})}>{typeof value==='number'?`Imagem #${value}`:'Selecionar imagem'}</button>{typeof value==='number'&&<button className="btn-ghost ml-2" type="button" onClick={()=>{updateValue(null);setMedia((m)=>{const n={...m};delete n[value];return n;})}}>Remover</button>}</>:<p className="text-sm text-ink-500">Sem permissão para selecionar imagens.</p>}</div>;
    if (descriptor.type==='link'||descriptor.type==='button') { const obj=(value&&typeof value==='object'?value:{label:'',url:''}) as {label:string;url:string}; return <fieldset key={descriptor.name} className="space-y-2 rounded border p-3"><legend className="px-1 text-sm font-medium">{descriptor.label}</legend><input className="input" aria-label="Texto do botão" value={obj.label??''} placeholder="Texto" onChange={(e)=>updateValue({...obj,label:e.target.value})}/><input className="input" aria-label="Link do botão" value={obj.url??''} placeholder="URL ou #seção" onChange={(e)=>updateValue({...obj,url:e.target.value})}/></fieldset>; }
    if (descriptor.type !== 'list') return null;
    const list=Array.isArray(value)?value as Record<string,unknown>[]:[];
    return <fieldset key={descriptor.name} className="space-y-3 rounded border p-3"><legend className="px-1 text-sm font-medium">{descriptor.label}</legend>{list.map((item,index)=><div key={index} className="space-y-2 rounded bg-ink-50 p-2">{descriptor.fields.map((child)=>{const input=child.type==='textarea'?<textarea className="input min-h-16" value={String(item[child.name]??'')} onChange={(e)=>updateValue(list.map((x,i)=>i===index?{...x,[child.name]:e.target.value}:x))}/>:<input className="input" value={String(item[child.name]??'')} onChange={(e)=>updateValue(list.map((x,i)=>i===index?{...x,[child.name]:e.target.value}:x))}/>;return <label key={child.name} className="block"><span className="text-xs">{child.label}</span>{input}</label>;})}<button className="text-xs text-red-700" type="button" disabled={list.length<=(descriptor.minItems??0)} onClick={()=>updateValue(list.filter((_,i)=>i!==index))}>Remover item</button></div>)}<button className="btn-ghost" type="button" disabled={list.length>=(descriptor.maxItems??20)} onClick={()=>updateValue([...list,Object.fromEntries(descriptor.fields.map((x)=>[x.name,'']))])}><Plus size={14}/>Adicionar item</button></fieldset>;
  }
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}));
  return <section className="panel space-y-4 p-5"><header className="flex items-center justify-between"><div><h2 className="font-semibold">Editor de seções</h2><p className="text-xs text-ink-500" role="status">{status}</p></div><button className="btn-ghost" type="button" onClick={()=>setPreview(!preview)}>{preview?'Editar':'Preview'} </button></header>
    {preview?<SectionPreview content={content} mediaUrls={media}/>:<div className="grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]"><div className="space-y-3"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({active,over})=>{if(!canStructure||!over||active.id===over.id)return;dirty.current=true;setContent((old)=>{const from=old.sections.findIndex(x=>x.id===active.id),to=old.sections.findIndex(x=>x.id===over.id);return {...old,sections:arrayMove(old.sections,from,to)};});}}><SortableContext items={content.sections.map((x)=>x.id)} strategy={verticalListSortingStrategy}>{content.sections.map((section)=><SortableRow key={section.id} section={section} canStructure={canStructure} selected={selected===section.id} onSelect={()=>setSelected(section.id)} onRemove={()=>{dirty.current=true;setContent((old)=>({...old,sections:old.sections.filter((x)=>x.id!==section.id)}));setSelected('');}} onDuplicate={()=>{const copy={...structuredClone(section),id:crypto.randomUUID()};dirty.current=true;setContent((old)=>({...old,sections:[...old.sections.slice(0,old.sections.indexOf(section)+1),copy,...old.sections.slice(old.sections.indexOf(section)+1)]}));setSelected(copy.id);}} onToggle={()=>{dirty.current=true;setContent((old)=>({...old,sections:old.sections.map((x)=>x.id===section.id?{...x,hidden:!x.hidden}:x)}));}} />)}</SortableContext></DndContext>
      {canStructure&&<select className="input" value="" onChange={(e)=>{if(!e.target.value)return;const item=newSection(e.target.value);dirty.current=true;setContent((old)=>({...old,sections:[...old.sections,item]}));setSelected(item.id);}}><option value="">+ Adicionar seção</option>{Object.values(sectionRegistry).map((x)=><option key={x.type} value={x.type}>{x.label}</option>)}</select>}</div>
      <div className="space-y-3">{selectedSection?<>{getSectionDefinition(selectedSection.type)!.fields.filter((f)=>(isMaster||getSectionDefinition(selectedSection.type)!.editableByClient.includes(f.name))&&(f.type!=='image'||can('media.select'))).map((f)=>field(selectedSection,f))}<div className="pt-2"><SectionPreview content={{sections:[selectedSection]}} mediaUrls={media}/></div></>:<p className="text-sm text-ink-500">Selecione ou adicione uma seção para editar.</p>}</div></div>}
    <MediaPicker open={picker.open} onClose={()=>setPicker({open:false,target:''})} onSelect={(item:MediaItem)=>{const section=content.sections.find((x)=>x.id===picker.target);if(section){update(section.id,'imageId',item.id);setMedia((old)=>({...old,[item.id]:`/uploads/${item.stored_name}`}));}setPicker({open:false,target:''});}}/>
  </section>;
}

import { z } from 'zod';

export const formFieldSchema=z.object({
  name:z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),label:z.string().trim().min(1).max(80),
  type:z.enum(['text','email','tel','textarea']),required:z.boolean().default(false),maxLength:z.number().int().min(1).max(2000).default(500),
}).strict();
export const formFieldsSchema=z.array(formFieldSchema).min(1).max(20).superRefine((fields,ctx)=>{
  const names=new Set<string>();fields.forEach((field,index)=>{if(names.has(field.name))ctx.addIssue({code:z.ZodIssueCode.custom,path:[index,'name'],message:'O nome do campo deve ser único.'});names.add(field.name);});
});
export type FormField=z.infer<typeof formFieldSchema>;
export type FormFieldList=z.infer<typeof formFieldsSchema>;

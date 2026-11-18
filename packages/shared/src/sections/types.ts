import type { ZodTypeAny } from 'zod';

export type FieldDescriptor =
  | { type: 'text' | 'textarea' | 'color'; name: string; label: string; maxLength?: number; help?: string }
  | { type: 'toggle' | 'image'; name: string; label: string; help?: string }
  | { type: 'link' | 'button'; name: string; label: string; help?: string }
  | { type: 'list'; name: string; label: string; itemLabel: string; minItems?: number; maxItems?: number; fields: FieldDescriptor[] };

export interface SectionDefinition {
  type: string;
  label: string;
  schemaVersion: number;
  propsSchema: ZodTypeAny;
  defaultProps: Record<string, unknown>;
  fields: FieldDescriptor[];
  editableByClient: string[];
}

export interface SectionInstance {
  id: string;
  type: string;
  schemaVersion: number;
  props: Record<string, unknown>;
  hidden?: boolean;
}

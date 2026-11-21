import type { ZodTypeAny } from 'zod';
import type { ComponentType } from 'react';

export type FieldDescriptor =
  | { type: 'text' | 'textarea' | 'color'; name: string; label: string; maxLength?: number; help?: string; editableByClient?: boolean }
  | { type: 'toggle' | 'image'; name: string; label: string; help?: string; editableByClient?: boolean }
  | { type: 'link' | 'button'; name: string; label: string; help?: string; editableByClient?: boolean }
  | { type: 'list'; name: string; label: string; itemLabel: string; min?: number; max?: number; minItems?: number; maxItems?: number; clientCanAdd?: boolean; clientCanRemove?: boolean; clientCanReorder?: boolean; itemSchema: ZodTypeAny; defaultItem?: Record<string, unknown>; fields: FieldDescriptor[]; editableByClient?: boolean };

export interface SectionDefinition {
  type: string;
  label: string;
  schemaVersion: number;
  propsSchema: ZodTypeAny;
  defaultProps: Record<string, unknown>;
  fields: FieldDescriptor[];
  editableByClient?: string[];
  clientCanHide?: boolean;
  component?: ComponentType<{ section: SectionInstance; mediaUrls?: Record<number, string> }>;
}

export interface SectionInstance {
  id: string;
  type: string;
  schemaVersion: number;
  props: Record<string, unknown>;
  hidden?: boolean;
  visible?: boolean;
}

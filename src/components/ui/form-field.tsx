'use client';

/**
 * Reusable form-field wrappers that bridge shadcn/ui's <Field> component
 * with react-hook-form's <Controller>.
 *
 * Use these for NEW forms (CSV import, recurring transactions, bill
 * reminders, savings goals, etc.). Do NOT refactor existing forms —
 * they're too custom and the migration cost outweighs the benefit.
 *
 * Example:
 *   const form = useForm<FormData>({ resolver: zodResolver(schema) });
 *   <FormInput control={form.control} name="email" label="Email" />
 */

import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── FormInput ─────────────────────────────────────────────────────────
interface FormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  autoComplete?: string;
}

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  type = 'text',
  disabled,
  autoComplete,
}: FormInputProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>{label}</FieldLabel>
          <Input
            {...field}
            value={field.value ?? ''}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete={autoComplete}
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.error && (
            <FieldError>{fieldState.error.message}</FieldError>
          )}
        </Field>
      )}
    />
  );
}

// ─── FormTextarea ──────────────────────────────────────────────────────
interface FormTextareaProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export function FormTextarea<T extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  rows = 3,
  disabled,
}: FormTextareaProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>{label}</FieldLabel>
          <Textarea
            {...field}
            value={field.value ?? ''}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.error && (
            <FieldError>{fieldState.error.message}</FieldError>
          )}
        </Field>
      )}
    />
  );
}

// ─── FormSelect ────────────────────────────────────────────────────────
export interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
  placeholder?: string;
  options: readonly SelectOption[];
  disabled?: boolean;
}

export function FormSelect<T extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  options,
  disabled,
}: FormSelectProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>{label}</FieldLabel>
          <Select
            value={field.value ?? ''}
            onValueChange={field.onChange}
            disabled={disabled || field.disabled}
          >
            <SelectTrigger aria-invalid={fieldState.invalid}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.error && (
            <FieldError>{fieldState.error.message}</FieldError>
          )}
        </Field>
      )}
    />
  );
}

// ─── FormNumberInput ───────────────────────────────────────────────────
// For numeric fields that should store a number (not a string) in form state.
interface FormNumberInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function FormNumberInput<T extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  min,
  max,
  step,
  disabled,
}: FormNumberInputProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>{label}</FieldLabel>
          <Input
            type="number"
            value={field.value ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              field.onChange(v === '' ? undefined : Number(v));
            }}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.error && (
            <FieldError>{fieldState.error.message}</FieldError>
          )}
        </Field>
      )}
    />
  );
}

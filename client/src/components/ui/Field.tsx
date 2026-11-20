// Form inputs with a label, optional hint, and an error shown right below (SRS IR-21).
//
//   <TextField label="Title" required value={title} onChange={e => setTitle(e.target.value)}
//              error={errors.title} hint="Up to 12 characters" maxLength={12} />
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const inputClass = (hasError: boolean) =>
  `block w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
      : "border-slate-300 focus:border-brand-500 focus:ring-brand-200"
  }`;

type WrapperProps = {
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  id: string;
  children: ReactNode;
};

function FieldWrapper({ label, required, hint, error, id, children }: WrapperProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1 font-normal text-slate-400">(optional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

type Common = { label: string; hint?: ReactNode; error?: string };

export function TextField({
  label,
  hint,
  error,
  required,
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldWrapper label={label} required={required} hint={hint} error={error} id={id}>
      <input
        id={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(!!error)}
        {...rest}
      />
    </FieldWrapper>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldWrapper label={label} required={required} hint={hint} error={error} id={id}>
      <textarea
        id={id}
        required={required}
        aria-invalid={!!error}
        rows={4}
        className={inputClass(!!error)}
        {...rest}
      />
    </FieldWrapper>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldWrapper label={label} required={required} hint={hint} error={error} id={id}>
      <select
        id={id}
        required={required}
        aria-invalid={!!error}
        className={inputClass(!!error)}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

export function Checkbox({
  label,
  error,
  ...rest
}: { label: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-slate-700">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** A plain input without label, e.g. a search box or the chat composer. */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass(false)} {...props} />;
}

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  span?: boolean;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, hint, error, span, children }: FieldProps) {
  return (
    <div className={`field${span ? ' span-2' : ''}`}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="field__required">*</span> : null}
      </label>
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

interface WithError {
  invalid?: boolean;
}

export function TextInput({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & WithError) {
  return <input className={`input${invalid ? ' input--invalid' : ''} ${className ?? ''}`.trim()} {...rest} />;
}

export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & WithError) {
  return (
    <select className={`select${invalid ? ' select--invalid' : ''} ${className ?? ''}`.trim()} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & WithError) {
  return <textarea className={`textarea${invalid ? ' textarea--invalid' : ''} ${className ?? ''}`.trim()} {...rest} />;
}

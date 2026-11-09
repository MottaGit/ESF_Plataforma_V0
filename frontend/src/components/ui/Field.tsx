import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { IconEye, IconEyeOff } from './Icons';

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

/**
 * Campo de senha com "Mostrar" / "Ocultar" (o olho dentro do campo): no celular, digitar a senha sem ver o que saiu e
 * o que mais faz errar, principalmente nos dois campos de criar a senha.
 */
export function PasswordInput({ invalid, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & WithError) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="password-field">
      <input
        type={visible ? 'text' : 'password'}
        className={`input${invalid ? ' input--invalid' : ''} ${className ?? ''}`.trim()}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...rest}
      />
      <button
        type="button"
        className="password-field__toggle"
        aria-label={visible ? 'Ocultar a senha' : 'Mostrar a senha'}
        aria-pressed={visible}
        title={visible ? 'Ocultar a senha' : 'Mostrar a senha'}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
      </button>
    </span>
  );
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

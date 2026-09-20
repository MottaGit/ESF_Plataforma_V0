import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

const variantClass: Record<Variant, string> = {
  default: '',
  primary: 'btn--primary',
  ghost: 'btn--ghost',
  danger: 'btn--danger'
};

export function Button({
  variant = 'default',
  small,
  block,
  loading,
  icon,
  children,
  className,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['btn', variantClass[variant], small ? 'btn--sm' : '', block ? 'btn--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : icon}
      {children}
    </button>
  );
}

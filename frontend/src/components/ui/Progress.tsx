interface ProgressProps {
  value: number;
  showValue?: boolean;
}

export function Progress({ value, showValue = true }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="progress">
      <div className="progress__track">
        <div
          className={`progress__fill${clamped >= 100 ? ' progress__fill--full' : ''}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue ? <span className="progress__value num">{clamped}%</span> : null}
    </div>
  );
}

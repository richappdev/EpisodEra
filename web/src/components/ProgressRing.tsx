interface ProgressRingProps {
  percent: number;
  size?: number;
  stroke?: number;
  label: string;
  className?: string;
}

export const ProgressRing = ({
  percent,
  size = 64,
  stroke = 5,
  label,
  className = "",
}: ProgressRingProps) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div className={`progress-ring ${className}`.trim()} style={{width: size, height: size}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={label} role="img">
        <circle
          className="progress-ring-track"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="progress-ring-fill"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="progress-ring-value" aria-hidden="true">
        {Math.round(clamped)}%
      </span>
    </div>
  );
};

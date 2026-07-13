interface SectionErrorProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const SectionError = ({message, onRetry, retryLabel = "Retry"}: SectionErrorProps) => (
  <div className="state-panel error section-error" role="alert">
    <span>{message}</span>
    {onRetry && (
      <button className="text-button" type="button" onClick={onRetry}>
        {retryLabel}
      </button>
    )}
  </div>
);

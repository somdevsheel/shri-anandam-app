export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent ${className}`} />;
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner />
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
      <p className="text-base font-semibold text-text">{title}</p>
      {message ? <p className="text-sm text-text-muted">{message}</p> : null}
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
      {message}
    </div>
  );
}

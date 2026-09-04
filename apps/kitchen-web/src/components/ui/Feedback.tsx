export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block size-8 animate-spin rounded-full border-4 border-primary border-t-transparent ${className}`} />;
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner />
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      <p className="text-2xl font-bold text-text">{title}</p>
      {message ? <p className="text-lg text-text-muted">{message}</p> : null}
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-2 border-danger/40 bg-danger/5 px-4 py-3 text-lg text-danger" role="alert">
      {message}
    </div>
  );
}

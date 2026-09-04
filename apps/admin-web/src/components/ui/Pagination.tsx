import { Button } from "./Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <span className="text-sm text-text-muted">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          Previous
        </Button>
        <Button variant="outline" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
          Next
        </Button>
      </div>
    </div>
  );
}

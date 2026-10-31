import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDocument, type Doc } from "@/lib/api.functions";
import { fileSize } from "@/lib/categories";

export function DocList({
  docs,
  onChange,
  className = "",
}: {
  docs: Doc[];
  onChange: () => void;
  className?: string;
}) {
  if (!docs.length) return null;
  return (
    <ul className={`space-y-1 ${className}`}>
      {docs.map((d) => (
        <li
          key={d.id}
          className="flex items-center gap-2 rounded-lg bg-secondary/70 py-1.5 pl-2.5 pr-1.5 text-sm"
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <a
            href={`/api/files/${d.id}`}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate font-medium hover:underline"
          >
            {d.filename}
          </a>
          <span className="text-xs tabular-nums text-muted-foreground">{fileSize(d.size)}</span>
          <button
            type="button"
            aria-label="Document verwijderen"
            className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
            onClick={async () => {
              if (!confirm(`${d.filename} verwijderen?`)) return;
              try {
                await deleteDocument({ data: { id: d.id } });
                onChange();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

import { Camera, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

const pill =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring";

/**
 * Bestand kiezen, plus op telefoon/tablet een knop die meteen de camera opent (voor een factuur of bewijs).
 */
export function AttachPicker({
  count = 0,
  label = "Factuur of bewijs bijvoegen",
  onPick,
  onClear,
  className,
}: {
  count?: number;
  label?: string;
  onPick: (files: File[]) => void;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label
        className={cn(
          pill,
          "border-dashed text-muted-foreground hover:border-input hover:text-foreground",
        )}
      >
        <Paperclip className="size-4" />
        {count ? `${count} bestand(en) gekozen` : label}
        <input
          type="file"
          multiple
          className="sr-only"
          aria-label="Bestand kiezen"
          onChange={(e) => {
            onPick(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      {/* Alleen op een aanraakscherm: op een computer heeft "foto nemen" geen zin. */}
      <label
        className={cn(pill, "hidden border-input bg-card font-medium pointer-coarse:inline-flex")}
      >
        <Camera className="size-4" />
        Foto nemen
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Foto nemen"
          onChange={(e) => {
            onPick(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      {count > 0 && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Wissen
        </button>
      )}
    </div>
  );
}

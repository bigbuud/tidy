import { categoryOf } from "@/lib/categories";
import { cn } from "@/lib/utils";

/** Foto van het item, of anders het gekleurde categorie-icoon. */
export function AssetAvatar({
  id,
  category,
  photoV,
  className,
  iconClassName = "size-5",
}: {
  id: number;
  category: string;
  photoV: number | null | undefined;
  className?: string;
  iconClassName?: string;
}) {
  const cat = categoryOf(category);
  const Icon = cat.icon;
  if (photoV) {
    return (
      <img
        src={`/api/photo/${id}?v=${photoV}`}
        alt=""
        className={cn("shrink-0 bg-secondary object-cover", className)}
      />
    );
  }
  return (
    <span className={cn("grid shrink-0 place-items-center", cat.tone, className)}>
      <Icon className={iconClassName} />
    </span>
  );
}

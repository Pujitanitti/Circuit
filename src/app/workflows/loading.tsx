import { SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="p-8">
      <div className="skeleton h-6 w-40 rounded-md" />
      <div className="skeleton mt-2 h-3 w-24 rounded-md" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}

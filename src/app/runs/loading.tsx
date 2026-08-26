import { SkeletonRow } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="p-8">
      <div className="skeleton h-6 w-24 rounded-md" />
      <div className="skeleton mt-2 h-3 w-32 rounded-md" />
      <div className="mt-6 overflow-hidden rounded-panel border border-canvas-border">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-canvas-border bg-canvas-surface px-4">
        <div className="skeleton h-3 w-40 rounded-md" />
        <div className="skeleton h-3 w-16 rounded-md" />
      </div>
      <div className="flex-1 p-8">
        <div className="skeleton h-64 w-full rounded-panel" />
      </div>
    </div>
  );
}

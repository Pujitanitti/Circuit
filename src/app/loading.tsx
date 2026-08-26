export default function Loading() {
  return (
    <div className="p-8">
      <div className="skeleton h-6 w-32 rounded-md" />
      <div className="skeleton mt-2 h-3 w-48 rounded-md" />
      <div className="mt-6 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel space-y-2 p-4">
            <div className="skeleton h-3 w-16 rounded-md" />
            <div className="skeleton h-6 w-12 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

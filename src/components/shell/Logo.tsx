// The mark: a single path enters, splits into two branches, and one branch
// terminates in a filled node — a literal trace of "trigger -> branch -> output".
// Works at 16px (favicon) up to full lockup because it's built from three
// straight segments and three circles, no fine detail to lose at small sizes.
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="4" cy="12" r="2.25" fill="#6D5AE6" />
      <path d="M6.25 12H11" stroke="#6D5AE6" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M11 12L16.5 6.5" stroke="#6D5AE6" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M11 12L16.5 17.5" stroke="#0E9CB8" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="11" cy="12" r="1.75" fill="#1C1F2A" />
      <circle cx="18.5" cy="6.5" r="2" fill="#6D5AE6" fillOpacity="0.18" stroke="#6D5AE6" strokeWidth="1.5" />
      <circle cx="18.5" cy="17.5" r="2" fill="#0E9F6E" />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="font-display text-[15px] font-medium tracking-tight text-ink">Circuit</span>
    </div>
  );
}

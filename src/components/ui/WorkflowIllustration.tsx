// A generic schematic (Trigger -> Agent -> Condition -> two branches) used
// only in empty states to teach the shape of a Circuit workflow before one
// exists. Deliberately NOT presented as a real workflow — no name, no
// fabricated stats — just the concept, using the same node accent colors
// real nodes use.
export function WorkflowIllustration() {
  return (
    <svg width="220" height="120" viewBox="0 0 220 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 20 H100" stroke="#E4E7EF" strokeWidth="2" />
      <path d="M100 20 H140" stroke="#E4E7EF" strokeWidth="2" />
      <path d="M140 20 V50" stroke="#E4E7EF" strokeWidth="2" />
      <path d="M140 50 L100 90" stroke="#E4E7EF" strokeWidth="2" />
      <path d="M140 50 L180 90" stroke="#E4E7EF" strokeWidth="2" />

      <rect x="10" y="6" width="60" height="28" rx="8" fill="#EEF0FA" stroke="#2563EB" strokeWidth="1.5" />
      <text x="40" y="24" textAnchor="middle" fontSize="9" fill="#2563EB" fontFamily="ui-monospace, monospace">Trigger</text>

      <rect x="105" y="6" width="60" height="28" rx="8" fill="#F1EEFC" stroke="#6D5AE6" strokeWidth="1.5" />
      <text x="135" y="24" textAnchor="middle" fontSize="9" fill="#6D5AE6" fontFamily="ui-monospace, monospace">Agent</text>

      <rect x="105" y="46" width="60" height="28" rx="8" fill="#FBF3E7" stroke="#B7791F" strokeWidth="1.5" />
      <text x="135" y="64" textAnchor="middle" fontSize="8" fill="#B7791F" fontFamily="ui-monospace, monospace">Condition</text>

      <rect x="65" y="86" width="55" height="26" rx="8" fill="#E8F6F0" stroke="#0E9F6E" strokeWidth="1.5" />
      <text x="92" y="103" textAnchor="middle" fontSize="8" fill="#0E9F6E" fontFamily="ui-monospace, monospace">Output</text>

      <rect x="150" y="86" width="55" height="26" rx="8" fill="#F4F6FA" stroke="#9BA0B0" strokeWidth="1.5" strokeDasharray="3 2" />
      <text x="177" y="103" textAnchor="middle" fontSize="8" fill="#9BA0B0" fontFamily="ui-monospace, monospace">Skipped</text>
    </svg>
  );
}

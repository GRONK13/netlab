/** NetLab mark: three linked nodes. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="nl-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#nl-logo)" />
      <path d="M9 11 L23 11 L16 22 Z" fill="none" stroke="#bfdbfe" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="9" cy="11" r="3.2" fill="#fff" />
      <circle cx="23" cy="11" r="3.2" fill="#fff" />
      <circle cx="16" cy="22" r="3.2" fill="#fff" />
    </svg>
  );
}

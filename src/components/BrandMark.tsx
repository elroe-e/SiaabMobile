/** The Siaab Mobile logo mark: a phone with signal bars and two signal waves on a navy tile. */
export function BrandMark({ size = 34, className = 'brand-mark' }: { size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <rect width="100" height="100" rx="22" fill="#12367f" />
    <g transform="translate(-2.5 5.5)">
      <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="26" y="26" width="34" height="54" rx="7" />
        <path d="M58 18a12 12 0 0 1 12 12" />
        <path d="M58 9a21 21 0 0 1 21 21" />
      </g>
      <g fill="#fff">
        <circle cx="34" cy="63.2" r="2.6" />
        <rect x="38.6" y="52" width="4.8" height="13.8" rx="2.4" />
        <rect x="45.2" y="44" width="4.8" height="21.8" rx="2.4" />
        <rect x="51.8" y="35" width="4.8" height="30.8" rx="2.4" />
      </g>
    </g>
  </svg>
}

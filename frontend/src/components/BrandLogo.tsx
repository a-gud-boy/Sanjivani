interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
}

export default function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  const sizeClass = SIZES[size] || SIZES.md

  return (
    <div
      className={`relative flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-105 ${sizeClass} ${className}`}
      aria-label="Sanjivani Logo"
    >
      <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
        <defs>
          <linearGradient id="sanjivaniGradReact" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0891b2" />
            <stop offset="50%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="leafGradReact" x1="16" y1="12" x2="48" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ecfdf5" />
          </linearGradient>
          <linearGradient id="goldGradReact" x1="20" y1="20" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width="64" height="64" rx="16" fill="url(#sanjivaniGradReact)" />

        {/* Subtle Decorative Ring */}
        <circle cx="32" cy="32" r="26" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Right Leaf */}
        <path
          d="M32 10 C46 14 53 28 47 43 C42 53 32 54 32 54 C32 54 32 40 32 30 C32 20 32 10 32 10 Z"
          fill="url(#leafGradReact)"
          opacity="0.95"
        />

        {/* Left Leaf */}
        <path
          d="M32 10 C18 14 11 28 17 43 C22 53 32 54 32 54 C32 54 32 40 32 30 C32 20 32 10 32 10 Z"
          fill="url(#leafGradReact)"
          opacity="0.82"
        />

        {/* Leaf Spine */}
        <path d="M32 14 V52" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />

        {/* Central Medical Healing Plus */}
        <rect x="29" y="23" width="6" height="18" rx="3" fill="#0d9488" />
        <rect x="23" y="29" width="18" height="6" rx="3" fill="#0d9488" />

        {/* Life Spark */}
        <circle cx="32" cy="32" r="3.2" fill="url(#goldGradReact)" />
        <circle cx="32" cy="13" r="2" fill="#fef08a" />
      </svg>
    </div>
  )
}

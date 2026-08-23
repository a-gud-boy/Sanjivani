interface QuickReplyChipsProps {
  chips: string[]
  onSelect: (text: string) => void
  disabled?: boolean
}

export default function QuickReplyChips({ chips, onSelect, disabled }: QuickReplyChipsProps) {
  if (!chips.length) return null

  return (
    <div
      className="flex flex-wrap gap-2 px-4 py-2 animate-fade-in"
      role="group"
      aria-label="Quick reply options"
    >
      {chips.map((chip, i) => (
        <button
          key={`${chip}-${i}`}
          onClick={() => onSelect(chip)}
          disabled={disabled}
          className="px-4 py-2 rounded-full border border-brand-cyan text-brand-cyan bg-white
                     text-sm font-medium
                     hover:bg-brand-cyan hover:text-white
                     active:scale-95
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all duration-150
                     min-h-[40px] select-none"
        >
          {chip}
        </button>
      ))}
    </div>
  )
}

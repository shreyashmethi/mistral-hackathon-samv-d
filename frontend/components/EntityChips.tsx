"use client";

interface EntityChipsProps {
  entities: string[];
  onTap: (entity: string) => void;
}

export default function EntityChips({ entities, onTap }: EntityChipsProps) {
  if (entities.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-samvad-border">
      <p className="text-[10px] text-samvad-muted mb-1.5 uppercase tracking-wider">
        Mentioned — tap to ask
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {entities.map((entity) => (
          <button
            key={entity}
            onClick={() => onTap(entity)}
            className="
              flex-shrink-0 px-3 py-1.5 rounded-full text-xs
              bg-samvad-surface border border-samvad-accent/40 text-samvad-accent
              hover:bg-samvad-accent/10 active:scale-95
              transition-all duration-150
            "
          >
            {entity}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

interface EntityChipsProps {
  entities: string[];
  onTap?: (entity: string) => void;
}

export default function EntityChips({ entities, onTap }: EntityChipsProps) {
  if (entities.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entities.map((entity) => (
        <button
          key={entity}
          onClick={() => onTap?.(entity)}
          className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-md border transition-colors hover:bg-[#FFF0C3]"
          style={{
            borderColor: "rgba(0,0,0,0.1)",
            backgroundColor: "#FFFAEB",
            color: "#1E1E1E",
          }}
        >
          {entity}
        </button>
      ))}
    </div>
  );
}

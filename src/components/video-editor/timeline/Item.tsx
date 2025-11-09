import { useItem } from "dnd-timeline";
import type { Span } from "dnd-timeline";
import { cn } from "@/lib/utils";

interface ItemProps {
  id: string;
  span: Span;
  rowId: string;
  children: React.ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function Item({ id, span, rowId, children, isSelected = false, onSelect }: ItemProps) {
  const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
    id,
    span,
    data: { rowId },
  });

  return (
    <div
      ref={setNodeRef}
      style={itemStyle}
      {...listeners}
      {...attributes}
      onPointerDownCapture={() => onSelect?.()}
    >
      <div style={itemContentStyle}>
        <div
          className={cn(
            "border border-indigo-400/40 rounded-lg shadow-sm w-full overflow-hidden flex items-center justify-center px-3 transition-all duration-150 cursor-grab active:cursor-grabbing group relative",
            isSelected ? "bg-indigo-600 ring-2 ring-indigo-300 shadow-xl" : "bg-indigo-500 hover:bg-indigo-600"
          )}
          style={{ height: 60 }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.();
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
          <span className="text-sm font-semibold text-white truncate relative z-10 drop-shadow-sm">
            {children}
          </span>
        </div>
      </div>
    </div>
  );
}
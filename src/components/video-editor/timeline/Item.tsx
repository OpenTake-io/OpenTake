import { useItem } from "dnd-timeline";
import type { Span } from "dnd-timeline";

interface ItemProps {
  id: string;
  span: Span;
  rowId: string;
  children: React.ReactNode;
}

export default function Item({ id, span, rowId, children }: ItemProps) {
  const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
    id,
    span,
    data: { rowId },
  });

  return (
    <div ref={setNodeRef} style={itemStyle} {...listeners} {...attributes}>
      <div style={itemContentStyle}>
        <div 
          className="border border-indigo-400/40 rounded-lg shadow-sm w-full overflow-hidden flex items-center justify-center px-3 bg-indigo-600 hover:bg-indigo-700 transition-all duration-150 cursor-grab active:cursor-grabbing group relative" 
          style={{ height: 60 }}
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
import { useRow } from "dnd-timeline";
import type { RowDefinition } from "dnd-timeline";

interface RowProps extends RowDefinition {
  children: React.ReactNode;
}

export default function Row({ id, children }: RowProps) {
  const { setNodeRef, rowWrapperStyle, rowStyle } = useRow({ id });

  return (
    <div
      className="border-b border-slate-100 bg-gradient-to-b from-slate-50/30 to-white/50"
      style={{ ...rowWrapperStyle, minHeight: 88 }}
    >
      <div ref={setNodeRef} style={rowStyle}>
        {children}
      </div>
    </div>
  );
}
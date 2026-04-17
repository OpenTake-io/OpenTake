import type { RowDefinition } from "dnd-timeline";
import { useRow } from "dnd-timeline";
import type { CSSProperties, ReactNode } from "react";

interface TrackProps extends RowDefinition {
	children: ReactNode;
	hint?: string;
	isEmpty?: boolean;
	trackStyle?: CSSProperties;
}

export default function Track({ id, children, hint, isEmpty, trackStyle }: TrackProps) {
	const { setNodeRef, rowWrapperStyle, rowStyle, rowSidebarStyle, setSidebarRef } = useRow({
		id,
	});

	return (
		<div
			className="group/track flex-1 overflow-hidden bg-transparent"
			style={{ ...rowWrapperStyle, marginBottom: 0, minHeight: 44, ...trackStyle }}
		>
			<div ref={setSidebarRef} style={rowSidebarStyle} />
			<div
				ref={setNodeRef}
				className="relative flex-1 overflow-hidden"
				style={{ ...rowStyle, minHeight: 44 }}
			>
				{isEmpty && hint ? (
					<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center select-none">
						<span className="rounded-full border border-white/[0.05] bg-white/[0.02] px-2 py-0.5 text-[9px] font-medium tracking-[0.04em] text-white/30 uppercase">
							{hint}
						</span>
					</div>
				) : null}
				{children}
			</div>
		</div>
	);
}

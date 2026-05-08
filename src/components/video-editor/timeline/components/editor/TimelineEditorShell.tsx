import { Plus } from "@phosphor-icons/react";
import type { ReactNode } from "react";

interface TimelineEditorShellProps {
	videoDuration: number;
	hideToolbar: boolean;
	toolbar: ReactNode;
	timelineViewport: ReactNode;
}

export default function TimelineEditorShell({
	videoDuration,
	hideToolbar,
	toolbar,
	timelineViewport,
}: TimelineEditorShellProps) {
	if (!videoDuration || videoDuration === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-editor-surface gap-3">
				<div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center">
					<Plus className="w-6 h-6 text-muted-foreground" />
				</div>
				<div className="text-center">
					<p className="text-sm font-medium text-muted-foreground">No Video Loaded</p>
					<p className="text-xs text-muted-foreground/70 mt-1">
						Drag and drop a video to start editing
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 min-h-0 flex flex-col bg-editor-bg overflow-hidden">
			{hideToolbar ? null : toolbar}
			{timelineViewport}
		</div>
	);
}

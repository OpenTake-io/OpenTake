import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toFileUrl } from "./projectPersistence";

export type ProjectLibraryEntry = {
	path: string;
	name: string;
	updatedAt: number;
	thumbnailPath: string | null;
	isCurrent: boolean;
	isInProjectsDirectory: boolean;
};

type ProjectBrowserDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entries: ProjectLibraryEntry[];
	onOpenProject: (projectPath: string) => void;
};

function formatUpdatedAt(updatedAt: number) {
	try {
		return new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		}).format(updatedAt);
	} catch {
		return new Date(updatedAt).toLocaleString();
	}
}

export default function ProjectBrowserDialog({
	open,
	onOpenChange,
	entries,
	onOpenProject,
}: ProjectBrowserDialogProps) {
	const visibleEntries = useMemo(() => entries.slice(0, 24), [entries]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-7xl border-white/10 bg-[#131317] p-0 text-slate-200 shadow-2xl">
				<DialogHeader className="border-b border-white/10 px-6 py-4">
					<DialogTitle className="text-lg font-semibold tracking-tight text-white">
						Projects
					</DialogTitle>
				</DialogHeader>
				<div className="max-h-[70vh] overflow-y-auto px-5 py-5">
					{visibleEntries.length > 0 ? (
						<div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-4">
							{visibleEntries.map((entry) => {
								const thumbnailSrc = entry.thumbnailPath ? toFileUrl(entry.thumbnailPath) : null;
								return (
									<button
										key={entry.path}
										type="button"
										onClick={() => onOpenProject(entry.path)}
										className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1f] text-left outline-none transition hover:border-white/20 hover:bg-[#202028] focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
									>
										<div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0d0d11]">
											{thumbnailSrc ? (
												<img
													src={thumbnailSrc}
													alt=""
													className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.015]"
													draggable={false}
												/>
											) : (
												<div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_55%),linear-gradient(180deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.02))] text-sm font-medium text-slate-400">
													No preview yet
												</div>
											)}
											<div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-3">
												<span className="rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-200 backdrop-blur">
													{entry.isInProjectsDirectory ? "Library" : "Recent"}
												</span>
												{entry.isCurrent ? (
													<span className="rounded-full bg-[#2563EB]/90 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white">
														Current
													</span>
												) : null}
											</div>
										</div>
										<div className="flex flex-1 flex-col gap-1 px-3 py-3">
											<div className="truncate text-[15px] font-semibold tracking-tight text-white">
												{entry.name}
											</div>
											<div className="truncate text-[11px] text-slate-500">{entry.path}</div>
											<div className="pt-1 text-[11px] text-slate-400">
												Updated {formatUpdatedAt(entry.updatedAt)}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					) : (
						<div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-8 text-center">
							<div className="text-lg font-semibold text-white">No saved projects yet</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

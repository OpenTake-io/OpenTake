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
										className="group flex flex-col gap-2 bg-transparent text-left outline-none transition focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
									>
										<div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[#0d0d11]">
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
											{entry.isCurrent ? (
												<div className="absolute right-3 top-3">
													<span className="rounded-full bg-[#2563EB]/92 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]">
														Current
													</span>
												</div>
											) : null}
										</div>
										<div className="flex flex-1 flex-col gap-1 px-1 py-1">
											<div className="truncate text-[15px] font-semibold tracking-tight text-white">
												{entry.name}
											</div>
											<div className="text-[11px] text-slate-400">
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

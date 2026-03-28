import { AlertCircle, Download, LoaderCircle, Rocket } from "lucide-react";
import { useEffect, useState } from "react";

type UpdateToastPayload = {
	version: string;
	detail: string;
	phase: "available" | "downloading" | "ready" | "error";
	delayMs: number;
	isPreview?: boolean;
	progressPercent?: number;
};

function formatDelayHours(delayMs: number) {
	const hours = Math.max(1, Math.round(delayMs / (60 * 60 * 1000)));
	return `${hours}h`;
}

function getToastTitle(payload: UpdateToastPayload) {
	if (payload.isPreview) {
		return "Update Toast Preview";
	}

	switch (payload.phase) {
		case "available":
			return `Recordly ${payload.version} is available`;
		case "downloading":
			return `Downloading Recordly ${payload.version}`;
		case "ready":
			return `Recordly ${payload.version} is ready`;
		case "error":
			return `Recordly ${payload.version} needs attention`;
	}
}

function getIcon(payload: UpdateToastPayload) {
	switch (payload.phase) {
		case "available":
			return <Download className="h-5 w-5" />;
		case "downloading":
			return <LoaderCircle className="h-5 w-5 animate-spin" />;
		case "ready":
			return <Rocket className="h-5 w-5" />;
		case "error":
			return <AlertCircle className="h-5 w-5" />;
	}
}

export function UpdateToastWindow() {
	const [payload, setPayload] = useState<UpdateToastPayload | null>(null);

	useEffect(() => {
		let mounted = true;

		void window.electronAPI.getCurrentUpdateToastPayload().then((nextPayload) => {
			if (mounted) {
				setPayload(nextPayload);
			}
		});

		const dispose = window.electronAPI.onUpdateToastStateChanged((nextPayload) => {
			setPayload(nextPayload);
		});

		return () => {
			mounted = false;
			dispose();
		};
	}, []);

	if (!payload) {
		return <div className="h-full w-full bg-transparent" />;
	}

	const normalizedProgress = Math.max(0, Math.min(100, Math.round(payload.progressPercent ?? 0)));

	return (
		<div className="flex h-full w-full items-center justify-center bg-transparent p-2">
			<div className="pointer-events-auto flex w-full max-w-[404px] items-start gap-3 rounded-[24px] border border-sky-300/20 bg-[#0d1117]/95 p-4 text-white shadow-2xl shadow-black/45 backdrop-blur-xl">
				<div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
					{getIcon(payload)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<p className="text-sm font-semibold tracking-tight">{getToastTitle(payload)}</p>
						{payload.isPreview ? (
							<span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-sky-200">
								Dev
							</span>
						) : null}
					</div>
					<p className="mt-1 text-sm leading-5 text-white/70">{payload.detail}</p>

					{payload.phase === "downloading" ? (
						<div className="mt-3">
							<div className="h-2 overflow-hidden rounded-full bg-white/10">
								<div
									className="h-full rounded-full bg-sky-300 transition-[width] duration-300"
									style={{ width: `${normalizedProgress}%` }}
								/>
							</div>
							<p className="mt-2 text-xs font-medium text-sky-100/85">{normalizedProgress}% downloaded</p>
						</div>
					) : null}

					<div className="mt-3 flex flex-wrap items-center gap-2">
						{payload.phase === "available" || payload.phase === "error" ? (
							<button
								type="button"
								onClick={async () => {
									if (payload.isPreview) {
										await window.electronAPI.dismissUpdateToast();
										return;
									}

									await window.electronAPI.downloadAvailableUpdate();
								}}
								className="rounded-xl bg-sky-400 px-3 py-2 text-xs font-semibold text-[#031a2c] transition-colors hover:bg-sky-300"
							>
								Download Update
							</button>
						) : null}

						{payload.phase === "ready" ? (
							<button
								type="button"
								onClick={async () => {
									await window.electronAPI.installDownloadedUpdate();
								}}
								className="rounded-xl bg-sky-400 px-3 py-2 text-xs font-semibold text-[#031a2c] transition-colors hover:bg-sky-300"
							>
								Install Update
							</button>
						) : null}

						{payload.phase === "downloading" ? (
							<button
								type="button"
								onClick={async () => {
									await window.electronAPI.dismissUpdateToast();
								}}
								className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
							>
								Hide
							</button>
						) : null}

						{payload.phase !== "downloading" ? (
							<button
								type="button"
								onClick={async () => {
									if (payload.isPreview) {
										await window.electronAPI.dismissUpdateToast();
										return;
									}

									await window.electronAPI.deferDownloadedUpdate(payload.delayMs);
								}}
								className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 transition-colors hover:bg-white/10"
							>
								Later ({formatDelayHours(payload.delayMs)})
							</button>
						) : null}

						{!payload.isPreview && payload.phase !== "downloading" ? (
							<button
								type="button"
								onClick={async () => {
									await window.electronAPI.skipUpdateVersion();
								}}
								className="rounded-xl border border-sky-300/15 bg-transparent px-3 py-2 text-xs font-medium text-white/65 transition-colors hover:bg-white/5 hover:text-white"
							>
								Skip This Version
							</button>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
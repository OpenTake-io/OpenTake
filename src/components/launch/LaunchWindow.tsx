import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Monitor,
	Mic,
	MicOff,
	ChevronUp,
	Pause,
	Square,
	X,
	Play,
	Minus,
	MoreVertical,
	FolderOpen,
	VideoIcon,
	Languages,
	Volume2,
	VolumeX,
	AppWindow,
} from "lucide-react";
import { RxDragHandleDots2 } from "react-icons/rx";
import { useAudioLevelMeter } from "../../hooks/useAudioLevelMeter";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { useScopedT } from "../../contexts/I18nContext";
import { AudioLevelMeter } from "../ui/audio-level-meter";
import { ContentClamp } from "../ui/content-clamp";
import { useI18n } from "@/contexts/I18nContext";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import type { AppLocale } from "@/i18n/config";
import styles from "./LaunchWindow.module.css";

interface DesktopSource {
	id: string;
	name: string;
	thumbnail: string | null;
	display_id: string;
	appIcon: string | null;
	sourceType?: "screen" | "window";
	appName?: string;
	windowTitle?: string;
}

const LOCALE_LABELS: Record<string, string> = {
	en: "EN",
	es: "ES",
	"zh-CN": "中文",
};

function IconButton({
	onClick,
	title,
	className = "",
	children,
}: {
	onClick?: () => void;
	title?: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			className={`${styles.ib} ${styles.electronNoDrag} ${className}`}
			onClick={onClick}
			title={title}
		>
			{children}
		</button>
	);
}

function DropdownItem({
	onClick,
	selected,
	icon,
	children,
	trailing,
}: {
	onClick: () => void;
	selected?: boolean;
	icon: ReactNode;
	children: ReactNode;
	trailing?: ReactNode;
}) {
	return (
		<button
			type="button"
			className={`${styles.ddItem} ${selected ? styles.ddItemSelected : ""}`}
			onClick={onClick}
		>
			<span className="shrink-0">{icon}</span>
			<span className="truncate">{children}</span>
			{trailing}
		</button>
	);
}

function Separator() {
	return <div className={styles.sep} />;
}

export function LaunchWindow() {
	const { locale, setLocale } = useI18n();
	const t = useScopedT("launch");

	const {
		recording,
		paused,
		toggleRecording,
		pauseRecording,
		resumeRecording,
		cancelRecording,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
	} = useScreenRecorder();

	const [recordingStart, setRecordingStart] = useState<number | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const [pausedAt, setPausedAt] = useState<number | null>(null);
	const [pausedTotal, setPausedTotal] = useState(0);
	const [selectedSource, setSelectedSource] = useState("Screen");
	const [hasSelectedSource, setHasSelectedSource] = useState(false);
	const [recordingsDirectory, setRecordingsDirectory] = useState<string | null>(null);
	const [activeDropdown, setActiveDropdown] = useState<"none" | "sources" | "more">("none");
	const [sources, setSources] = useState<DesktopSource[]>([]);
	const [sourcesLoading, setSourcesLoading] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const showMicControls = microphoneEnabled && !recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } =
		useMicrophoneDevices(microphoneEnabled);
	const { level } = useAudioLevelMeter({
		enabled: showMicControls,
		deviceId: microphoneDeviceId,
	});

	useEffect(() => {
		if (selectedDeviceId && selectedDeviceId !== "default") {
			setMicrophoneDeviceId(selectedDeviceId);
		}
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		let timer: NodeJS.Timeout | null = null;
		if (recording) {
			if (!recordingStart) {
				setRecordingStart(Date.now());
				setPausedTotal(0);
			}
			if (paused) {
				if (!pausedAt) setPausedAt(Date.now());
				if (timer) clearInterval(timer);
			} else {
				if (pausedAt) {
					setPausedTotal((prev) => prev + (Date.now() - pausedAt));
					setPausedAt(null);
				}
				timer = setInterval(() => {
					if (recordingStart) {
						setElapsed(Math.floor((Date.now() - recordingStart - pausedTotal) / 1000));
					}
				}, 1000);
			}
		} else {
			setRecordingStart(null);
			setElapsed(0);
			setPausedAt(null);
			setPausedTotal(0);
			if (timer) clearInterval(timer);
		}
		return () => {
			if (timer) clearInterval(timer);
		};
	}, [recording, recordingStart, paused, pausedAt, pausedTotal]);

	const formatTime = (seconds: number) => {
		const m = Math.floor(seconds / 60).toString().padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	useEffect(() => {
		const checkSelectedSource = async () => {
			if (!window.electronAPI) return;
			const source = await window.electronAPI.getSelectedSource();
			if (source) {
				setSelectedSource(source.name);
				setHasSelectedSource(true);
			} else {
				setSelectedSource("Screen");
				setHasSelectedSource(false);
			}
		};
		void checkSelectedSource();
		const interval = setInterval(checkSelectedSource, 500);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		const load = async () => {
			const result = await window.electronAPI.getRecordingsDirectory();
			if (result.success) setRecordingsDirectory(result.path);
		};
		void load();
	}, []);

	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setActiveDropdown("none");
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	const fetchSources = useCallback(async () => {
		if (!window.electronAPI) return;
		setSourcesLoading(true);
		try {
			const rawSources = await window.electronAPI.getSources({
				types: ["screen", "window"],
				thumbnailSize: { width: 160, height: 90 },
				fetchWindowIcons: true,
			});
			setSources(
				rawSources.map((s) => {
					const isWindow = s.id.startsWith("window:");
					const type = s.sourceType ?? (isWindow ? "window" : "screen");
					let displayName = s.name;
					let appName = s.appName;
					if (isWindow && !appName && s.name.includes(" — ")) {
						const parts = s.name.split(" — ");
						appName = parts[0]?.trim();
						displayName = parts.slice(1).join(" — ").trim() || s.name;
					} else if (isWindow && s.windowTitle) {
						displayName = s.windowTitle;
					}
					return {
						id: s.id,
						name: displayName,
						thumbnail: s.thumbnail,
						display_id: s.display_id,
						appIcon: s.appIcon,
						sourceType: type,
						appName,
						windowTitle: s.windowTitle ?? displayName,
					};
				}),
			);
		} catch (error) {
			console.error("Failed to fetch sources:", error);
		} finally {
			setSourcesLoading(false);
		}
	}, []);

	const toggleDropdown = (which: "sources" | "more") => {
		setActiveDropdown(activeDropdown === which ? "none" : which);
		if (activeDropdown !== which && which === "sources") fetchSources();
	};

	const handleSourceSelect = async (source: DesktopSource) => {
		await window.electronAPI.selectSource(source);
		setSelectedSource(source.name);
		setHasSelectedSource(true);
		setActiveDropdown("none");
		window.electronAPI.showSourceHighlight?.({
			...source,
			name: source.appName ? `${source.appName} — ${source.name}` : source.name,
			appName: source.appName,
		});
	};

	const openVideoFile = async () => {
		setActiveDropdown("none");
		const result = await window.electronAPI.openVideoFilePicker();
		if (result.canceled) return;
		if (result.success && result.path) {
			await window.electronAPI.setCurrentVideoPath(result.path);
			await window.electronAPI.switchToEditor();
		}
	};

	const openProjectFile = async () => {
		setActiveDropdown("none");
		const result = await window.electronAPI.loadProjectFile();
		if (result.canceled || !result.success) return;
		await window.electronAPI.switchToEditor();
	};

	const chooseRecordingsDirectory = async () => {
		setActiveDropdown("none");
		const result = await window.electronAPI.chooseRecordingsDirectory();
		if (result.canceled) return;
		if (result.success && result.path) setRecordingsDirectory(result.path);
	};

	const toggleMicrophone = () => {
		if (!recording) setMicrophoneEnabled(!microphoneEnabled);
	};

	const screenSources = sources.filter((s) => s.sourceType === "screen");
	const windowSources = sources.filter((s) => s.sourceType === "window");

	return (
		<div
			className="w-full h-full flex flex-col justify-end items-center bg-transparent"
			ref={dropdownRef}
		>
			{activeDropdown !== "none" && (
				<div className={`${styles.dropdown} ${styles.electronNoDrag}`}>
					{activeDropdown === "sources" && (
						<>
							{sourcesLoading ? (
								<div className="flex items-center justify-center py-6">
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#6b6b78]" />
								</div>
							) : (
								<>
									{screenSources.length > 0 && (
										<>
											<div className={styles.ddLabel}>Screens</div>
											{screenSources.map((source) => (
												<DropdownItem
													key={source.id}
													icon={<Monitor size={16} />}
													selected={selectedSource === source.name}
													onClick={() => handleSourceSelect(source)}
												>
													{source.name}
												</DropdownItem>
											))}
										</>
									)}
									{windowSources.length > 0 && (
										<>
											<div className={styles.ddLabel} style={screenSources.length > 0 ? { marginTop: 4 } : undefined}>
												Windows
											</div>
											{windowSources.map((source) => (
												<DropdownItem
													key={source.id}
													icon={<AppWindow size={16} />}
													selected={selectedSource === source.name}
													onClick={() => handleSourceSelect(source)}
												>
													{source.appName && source.appName !== source.name
														? `${source.appName} — ${source.name}`
														: source.name}
												</DropdownItem>
											))}
										</>
									)}
									{screenSources.length === 0 && windowSources.length === 0 && (
										<div className="text-center text-xs text-[#6b6b78] py-4">
											No sources found
										</div>
									)}
								</>
							)}
						</>
					)}

					{activeDropdown === "more" && (
						<>
							<DropdownItem
								icon={systemAudioEnabled ? <Volume2 size={16} className="text-[#6360f5]" /> : <VolumeX size={16} />}
								onClick={() => setSystemAudioEnabled(!systemAudioEnabled)}
								trailing={systemAudioEnabled ? <span className="ml-auto text-[#6360f5] text-xs">&#10003;</span> : undefined}
							>
								System Audio
							</DropdownItem>
							<DropdownItem icon={<FolderOpen size={16} />} onClick={chooseRecordingsDirectory}>
								Recordings Folder
							</DropdownItem>
							<DropdownItem icon={<VideoIcon size={16} />} onClick={openVideoFile}>
								{t("recording.openVideoFile")}
							</DropdownItem>
							<DropdownItem icon={<FolderOpen size={16} />} onClick={openProjectFile}>
								{t("recording.openProject")}
							</DropdownItem>
							<div className={styles.ddLabel} style={{ marginTop: 4 }}>Language</div>
							{SUPPORTED_LOCALES.map((code) => (
								<DropdownItem
									key={code}
									icon={<Languages size={16} />}
									selected={locale === code}
									onClick={() => { setLocale(code as AppLocale); setActiveDropdown("none"); }}
								>
									{LOCALE_LABELS[code] ?? code}
								</DropdownItem>
							))}
						</>
					)}
				</div>
			)}

			{showMicControls && (
				<div className={`flex items-center gap-2 mb-2 rounded-xl border border-white/[0.07] bg-[rgba(18,18,24,0.97)] px-3 py-2 shadow-xl ${styles.electronNoDrag}`}>
					<select
						value={microphoneDeviceId || selectedDeviceId}
						onChange={(e) => { setSelectedDeviceId(e.target.value); setMicrophoneDeviceId(e.target.value); }}
						className={`max-w-[230px] rounded-lg border border-[#2a2a34] bg-[#1a1a22] px-3 py-1 text-xs text-[#eeeef2] outline-none ${styles.micSelect}`}
					>
						{devices.map((device) => (
							<option key={device.deviceId} value={device.deviceId}>{device.label}</option>
						))}
					</select>
					<AudioLevelMeter level={level} className="w-24" />
				</div>
			)}

			<div className={`${styles.bar} ${styles.electronDrag} mb-2`}>
				<div className={`flex items-center px-0.5 ${styles.electronDrag}`}>
					<RxDragHandleDots2 size={14} className="text-[#6b6b78]" />
				</div>

				{recording ? (
					<>
						<div className="flex items-center gap-[5px]">
							<div className={`w-[7px] h-[7px] rounded-full ${paused ? "bg-[#fbbf24]" : `bg-[#f43f5e] ${styles.recDotBlink}`}`} />
							<span className={`text-[10px] font-bold tracking-[0.06em] ${paused ? "text-[#fbbf24]" : "text-[#f43f5e]"}`}>
								{paused ? "PAUSED" : "REC"}
							</span>
						</div>

						<span className={`font-mono text-xs font-semibold min-w-[52px] text-center tracking-[0.02em] ${paused ? "text-[#fbbf24]" : "text-[#eeeef2]"}`}>
							{formatTime(elapsed)}
						</span>

						<Separator />

						<IconButton title={microphoneEnabled ? t("recording.disableMicrophone") : t("recording.enableMicrophone")} className={microphoneEnabled ? styles.ibActive : ""}>
							{microphoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
						</IconButton>

						<Separator />

						<IconButton onClick={paused ? resumeRecording : pauseRecording} title={paused ? "Resume" : "Pause"} className={paused ? styles.ibGreen : ""}>
							{paused ? <Play size={18} fill="currentColor" strokeWidth={0} /> : <Pause size={18} />}
						</IconButton>

						<IconButton onClick={toggleRecording} title="Stop" className={styles.ibRed}>
							<Square size={16} fill="currentColor" strokeWidth={0} />
						</IconButton>

						<IconButton onClick={cancelRecording} title="Cancel">
							<X size={18} />
						</IconButton>
					</>
				) : (
					<>
						<button
							type="button"
							className={`${styles.screenSel} ${styles.electronNoDrag}`}
							onClick={() => toggleDropdown("sources")}
							title={selectedSource}
						>
							<Monitor size={16} />
							<ContentClamp truncateLength={10}>{selectedSource}</ContentClamp>
							<ChevronUp size={10} className={`text-[#6b6b78] ml-0.5 transition-transform duration-200 ${activeDropdown === "sources" ? "" : "rotate-180"}`} />
						</button>

						<Separator />

						<IconButton
							onClick={toggleMicrophone}
							title={microphoneEnabled ? t("recording.disableMicrophone") : t("recording.enableMicrophone")}
							className={microphoneEnabled ? styles.ibActive : ""}
						>
							{microphoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
						</IconButton>

						<Separator />

						<button
							type="button"
							className={`${styles.recBtn} ${styles.electronNoDrag}`}
							onClick={hasSelectedSource ? toggleRecording : () => toggleDropdown("sources")}
							title={t("recording.record")}
						>
							<div className={styles.recDot} />
						</button>

						<Separator />

						<IconButton onClick={() => toggleDropdown("more")} title="More">
							<MoreVertical size={18} />
						</IconButton>

						<IconButton onClick={() => window.electronAPI?.hudOverlayHide?.()} title={t("recording.hideHud")}>
							<Minus size={16} />
						</IconButton>

						<IconButton onClick={() => window.electronAPI?.hudOverlayClose?.()} title={t("recording.closeApp")}>
							<X size={16} />
						</IconButton>
					</>
				)}
			</div>
		</div>
	);
}

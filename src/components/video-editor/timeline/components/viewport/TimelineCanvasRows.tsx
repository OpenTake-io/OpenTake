import { Plus } from "@phosphor-icons/react";
import { useMemo, type MouseEventHandler } from "react";
import { cn } from "@/lib/utils";
import AudioWaveform from "../../AudioWaveform";
import glassStyles from "../../ItemGlass.module.css";
import Item from "../../Item";
import Row from "../../Row";
import { CLIP_ROW_ID, ZOOM_ROW_ID } from "../../core/constants";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../../core/rows";
import type { TimelineRenderItem } from "../../model/timelineModel";
import type { AudioPeaksData } from "../../useAudioPeaks";
import ClipMarkerOverlay from "../overlays/ClipMarkerOverlay";

interface TimelineCanvasRowsProps {
	items: TimelineRenderItem[];
	videoDurationMs: number;
	selectAllBlocksActive: boolean;
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	onSelectZoom?: (id: string | null) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	audioPeaks?: AudioPeaksData | null;
	direction: string;
	canShowGhostZoom: boolean;
	ghostStartMs: number | null;
	ghostStartOffsetPx: number;
	ghostWidthPx: number;
	onZoomRowMouseEnter: MouseEventHandler<HTMLDivElement>;
	onZoomRowMouseMove: MouseEventHandler<HTMLDivElement>;
	onZoomRowMouseLeave: MouseEventHandler<HTMLDivElement>;
	onZoomRowClick: MouseEventHandler<HTMLDivElement>;
}

export function TimelineCanvasRows({
	items,
	videoDurationMs,
	selectAllBlocksActive,
	selectedZoomId,
	selectedClipId,
	selectedAnnotationId,
	selectedAudioId,
	onSelectZoom,
	onSelectClip,
	onSelectAnnotation,
	onSelectAudio,
	audioPeaks,
	direction,
	canShowGhostZoom,
	ghostStartMs,
	ghostStartOffsetPx,
	ghostWidthPx,
	onZoomRowMouseEnter,
	onZoomRowMouseMove,
	onZoomRowMouseLeave,
	onZoomRowClick,
}: TimelineCanvasRowsProps) {
	const zoomItems = useMemo(() => items.filter((item) => item.rowId === ZOOM_ROW_ID), [items]);
	const clipItems = useMemo(() => items.filter((item) => item.rowId === CLIP_ROW_ID), [items]);
	const annotationItems = useMemo(
		() => items.filter((item) => isAnnotationTrackRowId(item.rowId)),
		[items],
	);
	const audioItems = useMemo(() => items.filter((item) => isAudioTrackRowId(item.rowId)), [items]);

	const audioRowIds = useMemo(
		() =>
			Array.from(
				new Set(audioItems.map((item) => getAudioTrackRowId(getAudioTrackIndex(item.rowId)))),
			).sort((left, right) => getAudioTrackIndex(left) - getAudioTrackIndex(right)),
		[audioItems],
	);
	const annotationRowIds = useMemo(
		() =>
			Array.from(
				new Set(
					annotationItems.map((item) =>
						getAnnotationTrackRowId(getAnnotationTrackIndex(item.rowId)),
					),
				),
			).sort((left, right) => getAnnotationTrackIndex(left) - getAnnotationTrackIndex(right)),
		[annotationItems],
	);

	return (
		<>
			<Row id={CLIP_ROW_ID} isEmpty={clipItems.length === 0} hint="Press C to split clip">
				{audioPeaks && <AudioWaveform peaks={audioPeaks} />}
				<ClipMarkerOverlay videoDurationMs={videoDurationMs} />
				{clipItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={selectAllBlocksActive || item.id === selectedClipId}
						onSelect={() => onSelectClip?.(item.id)}
						variant="clip"
					>
						{item.label}
					</Item>
				))}
			</Row>

			<Row
				id={ZOOM_ROW_ID}
				isEmpty={zoomItems.length === 0}
				onMouseEnter={onZoomRowMouseEnter}
				onMouseMove={onZoomRowMouseMove}
				onMouseLeave={onZoomRowMouseLeave}
				onClick={onZoomRowClick}
			>
				{canShowGhostZoom && ghostStartMs !== null && (
					<div className="absolute inset-0 z-[3] pointer-events-none">
						<div
							className="absolute top-1/2 -translate-y-1/2 h-[85%] min-h-[22px]"
							style={
								direction === "rtl"
									? { right: `${ghostStartOffsetPx}px`, width: `${ghostWidthPx}px` }
									: { left: `${ghostStartOffsetPx}px`, width: `${ghostWidthPx}px` }
							}
						>
							<div
								className={cn(
									glassStyles.glassPurple,
									"w-full h-full overflow-hidden flex items-center justify-center cursor-default relative opacity-80",
								)}
							>
								<div className={cn(glassStyles.zoomEndCap, glassStyles.left)} />
								<div className={cn(glassStyles.zoomEndCap, glassStyles.right)} />
								<div className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/45 bg-white/15 text-white">
									<Plus className="h-2.5 w-2.5" />
								</div>
							</div>
						</div>
					</div>
				)}
				{zoomItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={selectAllBlocksActive || item.id === selectedZoomId}
						onSelect={() => onSelectZoom?.(item.id)}
						zoomDepth={item.zoomDepth}
						zoomMode={item.zoomMode}
						variant="zoom"
					>
						{item.label}
					</Item>
				))}
			</Row>

			{annotationRowIds.map((rowId, index) => {
				const rowItems = annotationItems.filter(
					(item) => getAnnotationTrackRowId(getAnnotationTrackIndex(item.rowId)) === rowId,
				);
				return (
					<Row
						key={rowId}
						id={rowId}
						isEmpty={rowItems.length === 0}
						hint={index === 0 ? "Press A to add annotation" : undefined}
					>
						{rowItems.map((item) => (
							<Item
								id={item.id}
								key={item.id}
								rowId={item.rowId}
								span={item.span}
								isSelected={selectAllBlocksActive || item.id === selectedAnnotationId}
								onSelect={() => onSelectAnnotation?.(item.id)}
								variant="annotation"
							>
								{item.label}
							</Item>
						))}
					</Row>
				);
			})}

			{audioRowIds.map((rowId, index) => {
				const rowItems = audioItems.filter(
					(item) => getAudioTrackRowId(getAudioTrackIndex(item.rowId)) === rowId,
				);
				return (
					<Row
						key={rowId}
						id={rowId}
						isEmpty={rowItems.length === 0}
						hint={index === 0 ? "Click music icon to add audio" : undefined}
					>
						{rowItems.map((item) => (
							<Item
								id={item.id}
								key={item.id}
								rowId={item.rowId}
								span={item.span}
								isSelected={selectAllBlocksActive || item.id === selectedAudioId}
								onSelect={() => onSelectAudio?.(item.id)}
								variant="audio"
							>
								{item.label}
							</Item>
						))}
					</Row>
				);
			})}
		</>
	);
}

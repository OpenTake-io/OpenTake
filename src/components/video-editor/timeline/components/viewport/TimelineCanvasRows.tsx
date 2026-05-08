import { Plus } from "@phosphor-icons/react";
import { memo, useMemo, type MouseEventHandler } from "react";
import { cn } from "@/lib/utils";
import AudioWaveform from "../../AudioWaveform";
import glassStyles from "../../ItemGlass.module.css";
import Item from "../../Item";
import Row from "../../Row";
import { CLIP_ROW_ID, ZOOM_ROW_ID } from "../../core/constants";
import type { AudioPeaksData, TimelineRenderItem } from "../../core/timelineTypes";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../../core/rows";
import ClipMarkerOverlay from "../overlays/ClipMarkerOverlay";

const HINT_CLIP = "Press C to split clip";
const HINT_ANNOTATION = "Press A to add annotation";
const HINT_AUDIO = "Click music icon to add audio";

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

function TimelineCanvasRowsComponent({
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
	const { clipItems, zoomItems, annotationRows, audioRows } = useMemo(() => {
		const nextClipItems: TimelineRenderItem[] = [];
		const nextZoomItems: TimelineRenderItem[] = [];
		const annotationBuckets = new Map<number, TimelineRenderItem[]>();
		const audioBuckets = new Map<number, TimelineRenderItem[]>();

		for (const item of items) {
			if (item.rowId === CLIP_ROW_ID) {
				nextClipItems.push(item);
				continue;
			}
			if (item.rowId === ZOOM_ROW_ID) {
				nextZoomItems.push(item);
				continue;
			}
			if (isAnnotationTrackRowId(item.rowId)) {
				const trackIndex = getAnnotationTrackIndex(item.rowId);
				const bucket = annotationBuckets.get(trackIndex);
				if (bucket) bucket.push(item);
				else annotationBuckets.set(trackIndex, [item]);
				continue;
			}
			if (isAudioTrackRowId(item.rowId)) {
				const trackIndex = getAudioTrackIndex(item.rowId);
				const bucket = audioBuckets.get(trackIndex);
				if (bucket) bucket.push(item);
				else audioBuckets.set(trackIndex, [item]);
			}
		}

		const annotationRowsSorted = Array.from(annotationBuckets.entries())
			.sort(([left], [right]) => left - right)
			.map(([trackIndex, rowItems]) => ({
				rowId: getAnnotationTrackRowId(trackIndex),
				items: rowItems,
			}));
		const audioRowsSorted = Array.from(audioBuckets.entries())
			.sort(([left], [right]) => left - right)
			.map(([trackIndex, rowItems]) => ({
				rowId: getAudioTrackRowId(trackIndex),
				items: rowItems,
			}));

		return {
			clipItems: nextClipItems,
			zoomItems: nextZoomItems,
			annotationRows: annotationRowsSorted,
			audioRows: audioRowsSorted,
		};
	}, [items]);

	return (
		<>
			<Row id={CLIP_ROW_ID} isEmpty={clipItems.length === 0} hint={HINT_CLIP}>
				{audioPeaks && <AudioWaveform peaks={audioPeaks} />}
				<ClipMarkerOverlay videoDurationMs={videoDurationMs} />
				{clipItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={selectAllBlocksActive || item.id === selectedClipId}
						onSelectId={onSelectClip}
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
						onSelectId={onSelectZoom}
						zoomDepth={item.zoomDepth}
						zoomMode={item.zoomMode}
						variant="zoom"
					>
						{item.label}
					</Item>
				))}
			</Row>

			{annotationRows.map(({ rowId, items: rowItems }, index) => {
				return (
					<Row
						key={rowId}
						id={rowId}
						isEmpty={rowItems.length === 0}
						hint={index === 0 ? HINT_ANNOTATION : undefined}
					>
						{rowItems.map((item) => (
							<Item
								id={item.id}
								key={item.id}
								rowId={item.rowId}
								span={item.span}
								isSelected={selectAllBlocksActive || item.id === selectedAnnotationId}
								onSelectId={onSelectAnnotation}
								variant="annotation"
							>
								{item.label}
							</Item>
						))}
					</Row>
				);
			})}

			{audioRows.map(({ rowId, items: rowItems }, index) => {
				return (
					<Row
						key={rowId}
						id={rowId}
						isEmpty={rowItems.length === 0}
						hint={index === 0 ? HINT_AUDIO : undefined}
					>
						{rowItems.map((item) => (
							<Item
								id={item.id}
								key={item.id}
								rowId={item.rowId}
								span={item.span}
								isSelected={selectAllBlocksActive || item.id === selectedAudioId}
								onSelectId={onSelectAudio}
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

export const TimelineCanvasRows = memo(TimelineCanvasRowsComponent);

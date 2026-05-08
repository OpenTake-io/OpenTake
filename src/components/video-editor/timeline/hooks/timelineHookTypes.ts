export interface RegionIdLite {
	id: string;
	startMs: number;
	endMs: number;
}

export interface AudioRegionLite extends RegionIdLite {
	trackIndex?: number;
}

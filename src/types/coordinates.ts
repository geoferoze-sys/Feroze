export interface LatLngDD {
  lat: number;
  lng: number;
}

export interface DmsPart {
  deg: number;
  min: number;
  sec: number;
  dir: 'N' | 'S' | 'E' | 'W';
}

export interface LatLngDMS {
  lat: DmsPart;
  lng: DmsPart;
  formattedLat: string;
  formattedLng: string;
  combined: string;
}

export interface Qnd95Coord {
  easting: number;
  northing: number;
  formattedEasting: string;
  formattedNorthing: string;
  combined: string;
}

export interface QatarLocationPreset {
  id: string;
  name: string;
  nameAr?: string;
  category: string;
  lat: number;
  lng: number;
  easting: number;
  northing: number;
  description: string;
  isCustom?: boolean;
}

export interface ConversionHistoryItem {
  id: string;
  timestamp: number;
  direction: 'WGS_TO_QND' | 'QND_TO_WGS';
  wgsDD: { lat: number; lng: number };
  wgsDMS: string;
  qnd: { easting: number; northing: number };
  label?: string;
}

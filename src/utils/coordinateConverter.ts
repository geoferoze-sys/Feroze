import proj4 from 'proj4';
import {
  LatLngDD,
  DmsPart,
  LatLngDMS,
  Qnd95Coord,
  QatarLocationPreset,
} from '../types/coordinates';

// EPSG:2932 - QND95 / Qatar National Grid
// Transverse Mercator with International 1924 ellipsoid and 7-parameter Helmert transformation to WGS84
export const QND95_PROJ4_DEF =
  '+proj=tmerc +lat_0=24.45 +lon_0=51.2166666666667 +k=0.99999 +x_0=200000 +y_0=300000 +ellps=intl +towgs84=-119.4248,-303.65872,-11.00061,1.164298,0.174458,1.096259,3.657065 +units=m +no_defs';

// Register EPSG:2932 in proj4
proj4.defs('EPSG:2932', QND95_PROJ4_DEF);
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

/**
 * Approximate geographical bounding box for the State of Qatar
 */
export const QATAR_BOUNDS = {
  minLat: 24.4,
  maxLat: 26.3,
  minLng: 50.6,
  maxLng: 51.8,
  minEasting: 135000,
  maxEasting: 265000,
  minNorthing: 295000,
  maxNorthing: 505000,
};

/**
 * Check if WGS84 coordinates are within reasonable vicinity of Qatar
 */
export function isWithinQatarBounds(lat: number, lng: number): boolean {
  return (
    lat >= QATAR_BOUNDS.minLat &&
    lat <= QATAR_BOUNDS.maxLat &&
    lng >= QATAR_BOUNDS.minLng &&
    lng <= QATAR_BOUNDS.maxLng
  );
}

/**
 * Check if QND95 coordinates are within reasonable vicinity of Qatar
 */
export function isWithinQatarGridBounds(easting: number, northing: number): boolean {
  return (
    easting >= QATAR_BOUNDS.minEasting &&
    easting <= QATAR_BOUNDS.maxEasting &&
    northing >= QATAR_BOUNDS.minNorthing &&
    northing <= QATAR_BOUNDS.maxNorthing
  );
}

/**
 * Convert Decimal Degrees to DMS components
 */
export function ddToDmsPart(value: number, isLat: boolean): DmsPart {
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  const deg = Math.floor(absVal);
  const minRemainder = (absVal - deg) * 60;
  const min = Math.floor(minRemainder);
  const sec = (minRemainder - min) * 60;

  let dir: 'N' | 'S' | 'E' | 'W';
  if (isLat) {
    dir = isNegative ? 'S' : 'N';
  } else {
    dir = isNegative ? 'W' : 'E';
  }

  return {
    deg,
    min,
    sec: Math.round(sec * 1000) / 1000, // round to 3 decimal places
    dir,
  };
}

/**
 * Convert DMS components to Decimal Degrees
 */
export function dmsPartToDd(part: DmsPart): number {
  const { deg, min, sec, dir } = part;
  const dd = Math.abs(deg) + Math.abs(min) / 60 + Math.abs(sec) / 3600;
  return dir === 'S' || dir === 'W' ? -dd : dd;
}

/**
 * Format a DMS part into readable string: e.g., 25° 17' 07.44" N
 */
export function formatDmsPart(part: DmsPart): string {
  const secFormatted = part.sec.toFixed(2).padStart(5, '0');
  return `${part.deg}° ${part.min.toString().padStart(2, '0')}' ${secFormatted}" ${part.dir}`;
}

/**
 * Format full LatLng into DMS bundle
 */
export function formatLatLngDMS(lat: number, lng: number): LatLngDMS {
  const latPart = ddToDmsPart(lat, true);
  const lngPart = ddToDmsPart(lng, false);
  const formattedLat = formatDmsPart(latPart);
  const formattedLng = formatDmsPart(lngPart);
  return {
    lat: latPart,
    lng: lngPart,
    formattedLat,
    formattedLng,
    combined: `${formattedLat}, ${formattedLng}`,
  };
}

/**
 * Format a number with thousands commas and specified decimal places
 */
export function formatNumber(num: number, decimals = 3): string {
  if (isNaN(num)) return '0.000';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Convert WGS84 (Lat, Lng) to QND95 (Easting, Northing)
 */
export function wgs84ToQnd95(lat: number, lng: number): Qnd95Coord {
  // Proj4 takes [longitude, latitude] for EPSG:4326
  const result = proj4('EPSG:4326', 'EPSG:2932', [lng, lat]);
  const easting = result[0];
  const northing = result[1];

  const formattedEasting = formatNumber(easting, 3);
  const formattedNorthing = formatNumber(northing, 3);

  return {
    easting,
    northing,
    formattedEasting,
    formattedNorthing,
    combined: `E: ${formattedEasting} m, N: ${formattedNorthing} m`,
  };
}

/**
 * Convert QND95 (Easting, Northing) to WGS84 (DD and DMS)
 */
export function qnd95ToWgs84(
  easting: number,
  northing: number
): { dd: LatLngDD; dms: LatLngDMS; formattedDD: string } {
  // Proj4 converts EPSG:2932 to EPSG:4326 returning [lng, lat]
  const result = proj4('EPSG:2932', 'EPSG:4326', [easting, northing]);
  const lng = result[0];
  const lat = result[1];

  const dms = formatLatLngDMS(lat, lng);
  const formattedDD = `${lat >= 0 ? lat.toFixed(6) + '° N' : Math.abs(lat).toFixed(6) + '° S'}, ${
    lng >= 0 ? lng.toFixed(6) + '° E' : Math.abs(lng).toFixed(6) + '° W'
  }`;

  return {
    dd: { lat, lng },
    dms,
    formattedDD,
  };
}

/**
 * Preset landmarks across Qatar for quick testing and surveying reference
 */
export const QATAR_PRESETS: QatarLocationPreset[] = [
  {
    id: 'al-khor',
    name: 'Al Khor',
    nameAr: 'الخور',
    category: 'Municipality',
    lat: 25.6839,
    lng: 51.5058,
    easting: 229102.016,
    northing: 436638.171,
    description: 'Historic northern coastal city and municipality known for fishing and pearl diving',
  },
  {
    id: 'al-rayyan',
    name: 'Al Rayyan',
    nameAr: 'الريان',
    category: 'Municipality',
    lat: 25.2919,
    lng: 51.4244,
    easting: 220998.334,
    northing: 393197.632,
    description: 'Major municipality west of Doha, home to historic forts, education and sports hubs',
  },
  {
    id: 'al-ruwais',
    name: 'Al Ruwais',
    nameAr: 'الرويس',
    category: 'Northern City',
    lat: 26.1368,
    lng: 51.2162,
    easting: 200031.705,
    northing: 486780.965,
    description: 'Northernmost coastal port town on the tip of the Qatar Peninsula',
  },
  {
    id: 'al-wakrah',
    name: 'Al Wakrah',
    nameAr: 'الوكرة',
    category: 'Municipality',
    lat: 25.1768,
    lng: 51.6033,
    easting: 239051.839,
    northing: 380487.130,
    description: 'Historic harbor city and municipality directly south of Doha',
  },
  {
    id: 'zubarah',
    name: 'Al Zubarah Fort (UNESCO)',
    nameAr: 'قلعة الزبارة',
    category: 'Heritage',
    lat: 25.9768,
    lng: 51.0457,
    easting: 182958.403,
    northing: 469066.358,
    description: 'Historic military fort and UNESCO World Heritage site in northwest Qatar',
  },
  {
    id: 'aspire-zone',
    name: 'Aspire Zone (Khalifa Stadium)',
    nameAr: 'أسباير زون (استاد خليفة)',
    category: 'Sports',
    lat: 25.2638,
    lng: 51.4484,
    easting: 223420.705,
    northing: 390088.783,
    description: "Qatar's premier international sports city in Baaya, Al Rayyan",
  },
  {
    id: 'corniche',
    name: 'Doha Corniche',
    nameAr: 'كورنيش الدوحة',
    category: 'Landmark',
    lat: 25.2854,
    lng: 51.5310,
    easting: 231735.610,
    northing: 392498.417,
    description: 'Central waterfront promenade along Doha Bay',
  },
  {
    id: 'dukhan',
    name: 'Dukhan',
    nameAr: 'دخان',
    category: 'Industrial City',
    lat: 25.4297,
    lng: 50.7850,
    easting: 156654.408,
    northing: 408517.030,
    description: "West coast energy city and site of Qatar's first onshore oil discovery",
  },
  {
    id: 'education-city',
    name: 'Education City (Qatar Foundation)',
    nameAr: 'المدينة التعليمية',
    category: 'Education',
    lat: 25.3142,
    lng: 51.4419,
    easting: 222756.604,
    northing: 395670.770,
    description: 'Major research and higher education campus in Al Rayyan',
  },
  {
    id: 'hia',
    name: 'Hamad International Airport (HIA)',
    nameAr: 'مطار حمد الدولي',
    category: 'Transport',
    lat: 25.2731,
    lng: 51.6081,
    easting: 239504.707,
    northing: 391156.243,
    description: "Qatar's primary international aviation hub",
  },
  {
    id: 'katara',
    name: 'Katara Cultural Village',
    nameAr: 'حي كتارا الثقافي',
    category: 'Culture',
    lat: 25.3589,
    lng: 51.5247,
    easting: 231082.434,
    northing: 400639.037,
    description: 'Multidimensional cultural complex, amphitheatres, and galleries along the coast',
  },
  {
    id: 'khor-al-adaid',
    name: 'Khor Al Adaid (Inland Sea)',
    nameAr: 'خور العديد',
    category: 'Nature',
    lat: 24.6465,
    lng: 51.4162,
    easting: 220277.185,
    northing: 321704.874,
    description: 'UNESCO tentative natural reserve where sea meets rolling desert dunes in the southeast',
  },
  {
    id: 'lusail',
    name: 'Lusail Marina Promenade',
    nameAr: 'ممشى مارينا لوسيل',
    category: 'Urban',
    lat: 25.4052,
    lng: 51.5276,
    easting: 231362.431,
    northing: 405768.715,
    description: 'Modern waterfront smart city district north of Doha',
  },
  {
    id: 'lusail-stadium',
    name: 'Lusail Stadium',
    nameAr: 'استاد لوسيل',
    category: 'Sports',
    lat: 25.4208,
    lng: 51.4903,
    easting: 227605.941,
    northing: 407488.659,
    description: 'Iconic 88,000-seat stadium and host venue of the FIFA World Cup Final',
  },
  {
    id: 'mesaieed',
    name: 'Mesaieed Industrial City',
    nameAr: 'مدينة مسيعيد الصناعية',
    category: 'Industrial City',
    lat: 24.9917,
    lng: 51.5500,
    easting: 233729.401,
    northing: 359968.658,
    description: 'Southern industrial zone, deep sea port, and petrochemical manufacturing center',
  },
  {
    id: 'mia',
    name: 'Museum of Islamic Art (MIA)',
    nameAr: 'متحف الفن الإسلامي',
    category: 'Culture',
    lat: 25.2954,
    lng: 51.5392,
    easting: 232558.814,
    northing: 393608.135,
    description: 'Iconic architectural landmark designed by I.M. Pei on Doha Corniche',
  },
  {
    id: 'ras-laffan',
    name: 'Ras Laffan Industrial City',
    nameAr: 'مدينة رأس لفان الصناعية',
    category: 'Industrial City',
    lat: 25.9080,
    lng: 51.5280,
    easting: 231271.969,
    northing: 461469.890,
    description: 'World-leading LNG export facility and port on the northeast coast of Qatar',
  },
  {
    id: 'souq-waqif',
    name: 'Souq Waqif',
    nameAr: 'سوق واقف',
    category: 'Heritage',
    lat: 25.2867,
    lng: 51.5333,
    easting: 231966.915,
    northing: 392642.969,
    description: 'Renowned traditional marketplace and cultural epicenter in central Doha',
  },
  {
    id: 'pearl',
    name: 'The Pearl-Qatar (Porto Arabia)',
    nameAr: 'اللؤلؤة قطر',
    category: 'District',
    lat: 25.3712,
    lng: 51.5518,
    easting: 233806.753,
    northing: 402008.141,
    description: 'Iconic man-made archipelago island off the West Bay coast',
  },
  {
    id: 'west-bay',
    name: 'West Bay',
    nameAr: 'الخليج الغربي',
    category: 'Business District',
    lat: 25.3197,
    lng: 51.5284,
    easting: 231464.939,
    northing: 396297.439,
    description: 'Doha modern financial skyline, commercial, and diplomatic district',
  },
];

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Layers,
  Map as MapIcon,
  Crosshair,
  Copy,
  Check,
  Navigation,
  Compass,
  ArrowUpRight,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import {
  wgs84ToQnd95,
  formatLatLngDMS,
  formatNumber,
  isWithinQatarBounds,
} from '../utils/coordinateConverter';
import { Qnd95Coord, LatLngDMS } from '../types/coordinates';

interface MapSectionProps {
  targetLocation?: { lat: number; lng: number; label?: string } | null;
  onSendToConverter?: (lat: number, lng: number) => void;
}

type MapLayerType = 'satellite' | 'osm';
type PinLabelMode = 'wgs84' | 'qnd95';

// Custom SVG marker pin
const createCustomPinIcon = (color = '#2563eb', label?: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: none;">
        ${
          label
            ? `<div style="background: rgba(15, 23, 42, 0.96); color: #f8fafc; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 7px; white-space: nowrap; margin-bottom: 5px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1.5px solid ${color}; letter-spacing: 0.02em; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${label}</div>`
            : ''
        }
        <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));">
          <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27.5 17 42 17 42C17 42 34 27.5 34 17C34 7.61116 26.3888 0 17 0Z" fill="${color}"/>
          <circle cx="17" cy="16" r="7" fill="white"/>
          <circle cx="17" cy="16" r="3.5" fill="${color}"/>
        </svg>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [0, 0],
    popupAnchor: [0, -42],
  });
};

export const MapSection: React.FC<MapSectionProps> = ({
  targetLocation,
  onSendToConverter,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Active layer state: 'osm' by default, 'satellite' when user selects
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('osm');
  const [showSatelliteLabels, setShowSatelliteLabels] = useState<boolean>(true);

  // Cursor / pointer live coordinate state
  const [cursorCoords, setCursorCoords] = useState<{
    lat: number;
    lng: number;
    qnd: Qnd95Coord;
    dms: LatLngDMS;
  } | null>(null);

  // Marked pin coordinates
  const [pinnedCoords, setPinnedCoords] = useState<{
    lat: number;
    lng: number;
    qnd: Qnd95Coord;
    dms: LatLngDMS;
    label?: string;
  } | null>(null);

  // Pin label display format: 'wgs84' | 'qnd95'
  const [pinLabelMode, setPinLabelMode] = useState<PinLabelMode>('wgs84');

  // Active refs to eliminate stale closure bugs during map events
  const pinLabelModeRef = useRef<PinLabelMode>('wgs84');
  const activeLayerRef = useRef<MapLayerType>('osm');
  const pinnedCoordsRef = useRef<{
    lat: number;
    lng: number;
    qnd: Qnd95Coord;
    dms: LatLngDMS;
    label?: string;
  } | null>(null);

  useEffect(() => {
    pinLabelModeRef.current = pinLabelMode;
  }, [pinLabelMode]);

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    pinnedCoordsRef.current = pinnedCoords;
  }, [pinnedCoords]);

  // Is mouse actively hovering or moving over map
  const [isHoveringMap, setIsHoveringMap] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  // Helper to compute coordinates bundle
  const computeCoordinateBundle = useCallback((lat: number, lng: number) => {
    const qnd = wgs84ToQnd95(lat, lng);
    const dms = formatLatLngDMS(lat, lng);
    return { lat, lng, qnd, dms };
  }, []);

  // Format pin label text dynamically according to selected mode (WGS84 or QND95)
  // Ensures clean, single label without duplicate coordinate prefixes
  const getFormattedPinLabel = useCallback(
    (lat: number, lng: number, _placeName?: string, mode?: PinLabelMode) => {
      const activeMode = mode || pinLabelModeRef.current;
      const qnd = wgs84ToQnd95(lat, lng);

      if (activeMode === 'wgs84') {
        return `WGS84: ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
      }
      return `QND95: E ${Math.round(qnd.easting).toLocaleString()}, N ${Math.round(
        qnd.northing
      ).toLocaleString()}`;
    },
    []
  );

  // Helper to get marker color according to coordinate mode & map layer
  const getPinColor = useCallback(
    (mode?: PinLabelMode, layer?: MapLayerType) => {
      const activeMode = mode || pinLabelModeRef.current;
      const currentLayer = layer || activeLayerRef.current;
      if (activeMode === 'qnd95') return '#10b981'; // Emerald for QND95
      return currentLayer === 'satellite' ? '#38bdf8' : '#2563eb'; // Cyan/Blue for WGS84
    },
    []
  );

  // Set or update pinned location
  const dropPin = useCallback(
    (lat: number, lng: number, label?: string) => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;
      const coordsBundle = computeCoordinateBundle(lat, lng);
      const newPinned = { ...coordsBundle, label };
      setPinnedCoords(newPinned);
      pinnedCoordsRef.current = newPinned;

      const currentMode = pinLabelModeRef.current;
      const displayedLabel = getFormattedPinLabel(lat, lng, label, currentMode);
      const pinColor = getPinColor(currentMode, activeLayerRef.current);

      // Update leaflet marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        markerRef.current.setIcon(createCustomPinIcon(pinColor, displayedLabel));
      } else {
        const newMarker = L.marker([lat, lng], {
          icon: createCustomPinIcon(pinColor, displayedLabel),
          draggable: true,
        }).addTo(map);

        newMarker.on('drag', (e: L.LeafletEvent) => {
          const marker = e.target as L.Marker;
          const pos = marker.getLatLng();
          const bundle = computeCoordinateBundle(pos.lat, pos.lng);
          const draggedPinned = { ...bundle, label: 'Custom Pin' };
          setPinnedCoords(draggedPinned);
          pinnedCoordsRef.current = draggedPinned;
          setCursorCoords(bundle);

          const activeMode = pinLabelModeRef.current;
          const dragLabel = getFormattedPinLabel(pos.lat, pos.lng, 'Custom Pin', activeMode);
          const dragPinColor = getPinColor(activeMode, activeLayerRef.current);
          marker.setIcon(createCustomPinIcon(dragPinColor, dragLabel));
        });

        markerRef.current = newMarker;
      }
    },
    [computeCoordinateBundle, getFormattedPinLabel, getPinColor]
  );

  // Synchronous handler when user clicks WGS84 or QND95 button
  const handleSetPinLabelMode = (newMode: PinLabelMode) => {
    setPinLabelMode(newMode);
    pinLabelModeRef.current = newMode;
    if (markerRef.current && pinnedCoordsRef.current) {
      const coords = pinnedCoordsRef.current;
      const displayedLabel = getFormattedPinLabel(
        coords.lat,
        coords.lng,
        coords.label,
        newMode
      );
      const pinColor = getPinColor(newMode, activeLayerRef.current);
      markerRef.current.setIcon(createCustomPinIcon(pinColor, displayedLabel));
    }
  };

  // Sync marker icon on map whenever pinLabelMode or activeLayer changes
  useEffect(() => {
    if (markerRef.current && pinnedCoords) {
      const displayedLabel = getFormattedPinLabel(
        pinnedCoords.lat,
        pinnedCoords.lng,
        pinnedCoords.label,
        pinLabelMode
      );
      const pinColor = getPinColor(pinLabelMode, activeLayer);
      markerRef.current.setIcon(createCustomPinIcon(pinColor, displayedLabel));
    }
  }, [pinLabelMode, activeLayer, pinnedCoords, getFormattedPinLabel, getPinColor]);

  // Tile layer sources
  const getTileLayer = useCallback((layerType: MapLayerType) => {
    if (layerType === 'osm') {
      return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      });
    } else {
      // Esri World Imagery (Satellite)
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
        }
      );
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center on Doha Corniche / Qatar
    const initialLat = targetLocation ? targetLocation.lat : 25.2854;
    const initialLng = targetLocation ? targetLocation.lng : 51.531;
    const initialZoom = targetLocation ? 13 : 10;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false, // We'll add custom/repositioned controls
    });

    // Add zoom control top-right for mobile ergonomics
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial base tile layer (OpenStreetMap by default, Satellite when user selects)
    const baseLayer = getTileLayer('osm');
    baseLayer.addTo(map);
    activeTileLayerRef.current = baseLayer;

    // Prepared satellite overlay labels (added only when user switches to satellite)
    const labelsLayer = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, opacity: 0.85 }
    );
    labelsTileLayerRef.current = labelsLayer;

    // Mouse move & pointer move listener on map
    const handleMapPointerMove = (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const bundle = computeCoordinateBundle(lat, lng);
      setCursorCoords(bundle);
      setIsHoveringMap(true);
    };

    map.on('mousemove', handleMapPointerMove);

    // Click/touch listener on map to pin point
    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      dropPin(lat, lng, 'Selected Point');
      const bundle = computeCoordinateBundle(lat, lng);
      setCursorCoords(bundle);
    });

    mapInstanceRef.current = map;

    // Ensure map tiles render without grey zones on mobile mount
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    const handleWindowResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleWindowResize);

    // Drop initial pin
    dropPin(initialLat, initialLng, targetLocation?.label || 'Doha Corniche');
    setCursorCoords(computeCoordinateBundle(initialLat, initialLng));

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleWindowResize);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [computeCoordinateBundle, dropPin, getTileLayer, targetLocation]);

  // Update target location if changed from parent
  useEffect(() => {
    if (targetLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView([targetLocation.lat, targetLocation.lng], 14, {
        animate: true,
      });
      dropPin(targetLocation.lat, targetLocation.lng, targetLocation.label || 'Selected Target');
      setCursorCoords(computeCoordinateBundle(targetLocation.lat, targetLocation.lng));
    }
  }, [targetLocation, dropPin, computeCoordinateBundle]);

  // Handle Layer switching between OSM and Satellite
  const handleSwitchLayer = (newLayer: MapLayerType) => {
    if (!mapInstanceRef.current || newLayer === activeLayer) return;
    const map = mapInstanceRef.current;

    // Remove current base tile layer
    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }

    // Add new base layer
    const nextLayer = getTileLayer(newLayer);
    nextLayer.addTo(map);
    activeTileLayerRef.current = nextLayer;

    // Handle satellite labels overlay
    if (newLayer === 'satellite' && showSatelliteLabels) {
      if (labelsTileLayerRef.current && !map.hasLayer(labelsTileLayerRef.current)) {
        labelsTileLayerRef.current.addTo(map);
      }
    } else {
      if (labelsTileLayerRef.current && map.hasLayer(labelsTileLayerRef.current)) {
        map.removeLayer(labelsTileLayerRef.current);
      }
    }

    setActiveLayer(newLayer);

    // Update marker styling if exists
    if (pinnedCoordsRef.current && markerRef.current) {
      const coords = pinnedCoordsRef.current;
      const currentMode = pinLabelModeRef.current;
      const displayedLabel = getFormattedPinLabel(
        coords.lat,
        coords.lng,
        coords.label,
        currentMode
      );
      const pinColor = getPinColor(currentMode, newLayer);
      markerRef.current.setIcon(createCustomPinIcon(pinColor, displayedLabel));
    }
  };

  // Toggle Satellite Labels Overlay
  const toggleSatelliteLabels = () => {
    if (!mapInstanceRef.current || !labelsTileLayerRef.current) return;
    const map = mapInstanceRef.current;
    if (showSatelliteLabels) {
      map.removeLayer(labelsTileLayerRef.current);
      setShowSatelliteLabels(false);
    } else {
      labelsTileLayerRef.current.addTo(map);
      setShowSatelliteLabels(true);
    }
  };

  // Reset to full Qatar view
  const handleResetToQatar = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([25.3548, 51.1839], 9, { animate: true });
  };

  // Locate user GPS position
  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 14, { animate: true });
          dropPin(latitude, longitude, 'My GPS Location');
          setCursorCoords(computeCoordinateBundle(latitude, longitude));
        }
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Active coordinates to display in panel below the map
  // Priority: cursor live coordinates, fallback to pinned coords
  const displayCoords = cursorCoords || pinnedCoords;

  return (
    <div className="space-y-2.5 pb-2">
      {/* Map Control Bar & Quick Landmark Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 shadow-2xs border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        {/* Layer Selector: OpenStreetMap vs Satellite Image Map */}
        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => handleSwitchLayer('osm')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeLayer === 'osm'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>OpenStreetMap</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchLayer('satellite')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeLayer === 'satellite'
                ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Satellite Image</span>
          </button>
        </div>

        {/* Auxiliary Controls */}
        <div className="flex items-center gap-1.5">
          {activeLayer === 'satellite' && (
            <button
              type="button"
              onClick={toggleSatelliteLabels}
              className={`px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
                showSatelliteLabels
                  ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
              title="Toggle Street and Place Labels on Satellite"
            >
              Labels {showSatelliteLabels ? 'ON' : 'OFF'}
            </button>
          )}

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            title="Center on my GPS location"
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium cursor-pointer"
          >
            <Navigation className={`w-3.5 h-3.5 text-blue-500 ${isLocating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">My GPS</span>
          </button>

          <button
            type="button"
            onClick={handleResetToQatar}
            title="Reset to whole Qatar extent"
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Qatar Extent</span>
          </button>
        </div>
      </div>

      {/* Map Card Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xs bg-slate-900">
        {/* Map Canvas */}
        <div
          ref={mapContainerRef}
          className="w-full h-[46vh] min-h-[300px] max-h-[520px] cursor-crosshair-map"
          onMouseEnter={() => setIsHoveringMap(true)}
          onMouseLeave={() => setIsHoveringMap(false)}
        />

        {/* Floating In-Map Overlays */}
        <div className="absolute top-2.5 left-2.5 z-[400] flex flex-col gap-1 pointer-events-none">
          {/* Active Mode Tag */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium border border-white/10 shadow-xs">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeLayer === 'satellite' ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span>
              {activeLayer === 'satellite' ? 'Satellite View Active' : 'OpenStreetMap Active'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/60 backdrop-blur-xs text-[10px] text-slate-300">
            <span>Move cursor or tap to read coordinates</span>
          </div>
        </div>

        {/* Pin Label toggle: WGS84 or QND95 */}
        <div className="absolute bottom-2.5 left-2.5 z-[400] bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-white/20 shadow-lg flex items-center">
          <div className="flex items-center bg-slate-800/95 rounded-md p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => handleSetPinLabelMode('wgs84')}
              title="Display pin label as WGS84 coordinates on the map pin"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                pinLabelMode === 'wgs84'
                  ? 'bg-blue-600 text-white shadow-2xs ring-1 ring-blue-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  pinLabelMode === 'wgs84' ? 'bg-white animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>WGS84</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetPinLabelMode('qnd95')}
              title="Display pin label as QND95 coordinates on the map pin"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                pinLabelMode === 'qnd95'
                  ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-750'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  pinLabelMode === 'qnd95' ? 'bg-white animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span>QND95</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Coordinate Display Box BELOW the map */}
      <div
        className={`rounded-xl p-3 sm:p-3.5 transition-all duration-200 border ${
          activeLayer === 'satellite'
            ? 'bg-gradient-to-b from-slate-900 to-slate-950 text-white border-cyan-500/40 shadow-md shadow-cyan-950/20'
            : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-2xs'
        }`}
      >
        {/* Panel Header */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800/80 mb-2">
          <div className="flex items-center gap-1.5">
            <div
              className={`p-1 rounded-md ${
                activeLayer === 'satellite'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
              }`}
            >
              <Crosshair className={`w-3.5 h-3.5 ${isHoveringMap ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <span>
                  {activeLayer === 'satellite'
                    ? 'Satellite Real-Time Cursor Coordinates'
                    : 'Map Inspection Coordinates'}
                </span>
                {activeLayer === 'satellite' && (
                  <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Live
                  </span>
                )}
              </h3>
              <p
                className={`text-[10.5px] leading-tight ${
                  activeLayer === 'satellite'
                    ? 'text-cyan-200/70'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isHoveringMap
                  ? 'Tracking cursor position live on map canvas'
                  : 'Coordinates at cursor position or pinned location'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          {displayCoords && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `Lat: ${displayCoords.lat.toFixed(6)}, Lng: ${displayCoords.lng.toFixed(
                      6
                    )} | QND95 E: ${displayCoords.qnd.formattedEasting} m, N: ${
                      displayCoords.qnd.formattedNorthing
                    } m`,
                    'all-cursor-coords'
                  )
                }
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  activeLayer === 'satellite'
                    ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {copiedKey === 'all-cursor-coords' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy All</span>
                  </>
                )}
              </button>

              {onSendToConverter && (
                <button
                  type="button"
                  onClick={() => onSendToConverter(displayCoords.lat, displayCoords.lng)}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer transition-colors"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Send to Converter</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Readout Grid */}
        {displayCoords ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* 1. WGS84 Decimal Degrees */}
            <div
              className={`p-2.5 rounded-lg border ${
                activeLayer === 'satellite'
                  ? 'bg-slate-800/80 border-slate-700'
                  : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    activeLayer === 'satellite' ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  WGS84 Decimal Degrees
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `${displayCoords.lat.toFixed(6)}, ${displayCoords.lng.toFixed(6)}`,
                      'cursor-dd'
                    )
                  }
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  title="Copy DD"
                >
                  {copiedKey === 'cursor-dd' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              <div className="space-y-0.5 font-mono text-xs sm:text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-slate-400">Lat:</span>
                  <span className="font-bold text-blue-500 dark:text-blue-400">
                    {displayCoords.lat >= 0
                      ? `${displayCoords.lat.toFixed(6)}° N`
                      : `${Math.abs(displayCoords.lat).toFixed(6)}° S`}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-slate-400">Lng:</span>
                  <span className="font-bold text-blue-500 dark:text-blue-400">
                    {displayCoords.lng >= 0
                      ? `${displayCoords.lng.toFixed(6)}° E`
                      : `${Math.abs(displayCoords.lng).toFixed(6)}° W`}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Qatar National Grid (QND95 - EPSG:2932) */}
            <div
              className={`p-2.5 rounded-lg border ${
                activeLayer === 'satellite'
                  ? 'bg-slate-800/80 border-cyan-500/30'
                  : 'bg-slate-50 dark:bg-slate-850 border-emerald-200 dark:border-emerald-800/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    activeLayer === 'satellite' ? 'text-cyan-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  QND95 Qatar Grid (m)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      `E: ${displayCoords.qnd.formattedEasting} m, N: ${displayCoords.qnd.formattedNorthing} m`,
                      'cursor-qnd'
                    )
                  }
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                  title="Copy QND95"
                >
                  {copiedKey === 'cursor-qnd' ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              <div className="space-y-0.5 font-mono text-xs sm:text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-slate-400">Easting (X):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {displayCoords.qnd.formattedEasting}{' '}
                    <span className="text-[10px] font-normal text-slate-400">m</span>
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-slate-400">Northing (Y):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {displayCoords.qnd.formattedNorthing}{' '}
                    <span className="text-[10px] font-normal text-slate-400">m</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-slate-400">
            Hover over the map or tap any location to inspect coordinates.
          </div>
        )}

        {/* Territory Status */}
        {displayCoords && !isWithinQatarBounds(displayCoords.lat, displayCoords.lng) && (
          <div className="mt-3 text-[11px] text-amber-400 flex items-center gap-1.5 bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-800/40">
            <span>Pointer is outside Qatar territory. QND95 calculation projected from central origin.</span>
          </div>
        )}
      </div>
    </div>
  );
};

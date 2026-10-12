import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { toBlob } from 'html-to-image';
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
  Download,
  Share2,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';
import { QatarCompassLogo } from './Navbar';
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

// WhatsApp Icon Component
export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    role="img"
    aria-label="WhatsApp"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export const MapSection: React.FC<MapSectionProps> = ({
  targetLocation,
  onSendToConverter,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const captureAreaRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Active layer state: 'osm' by default, 'satellite' when user selects
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('osm');
  const [showSatelliteLabels, setShowSatelliteLabels] = useState<boolean>(true);

  // Screenshot capture & WhatsApp sharing state
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(10);
  const [fallbackModalData, setFallbackModalData] = useState<{
    blob: Blob;
    imageUrl: string;
    fileName: string;
    shareText: string;
  } | null>(null);

  // Cursor / pointer live coordinate state
  const [cursorCoords, setCursorCoords] = useState<{
    lat: number;
    lng: number;
    qnd: Qnd95Coord;
    dms: LatLngDMS;
    label?: string;
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

  const showNotification = (msg: string) => {
    setShareToast(msg);
    setTimeout(() => {
      setShareToast((prev) => (prev === msg ? null : prev));
    }, 3500);
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
        crossOrigin: true,
      });
    } else {
      // Esri World Imagery (Satellite)
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
          crossOrigin: true,
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
      { maxZoom: 19, opacity: 0.85, crossOrigin: true }
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
    setCurrentZoom(map.getZoom());

    const handleZoomOrMove = () => {
      if (mapInstanceRef.current) {
        setCurrentZoom(mapInstanceRef.current.getZoom());
      }
    };
    map.on('zoomend', handleZoomOrMove);
    map.on('moveend', handleZoomOrMove);

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
      map.off('zoomend', handleZoomOrMove);
      map.off('moveend', handleZoomOrMove);
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

  // Dynamic cartographic graphic scale calculation based on latitude and map zoom
  const currentLat = displayCoords?.lat || 25.2854;
  const metersPerPixel =
    (156543.03392 * Math.cos((currentLat * Math.PI) / 180)) / Math.pow(2, currentZoom);

  // Target standard metric interval for ~70-110px bar
  const targetDistance = metersPerPixel * 85;
  const standardScales = [
    10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000
  ];
  let scaleMeters = standardScales[0];
  for (const s of standardScales) {
    if (Math.abs(s - targetDistance) < Math.abs(scaleMeters - targetDistance)) {
      scaleMeters = s;
    }
  }
  const scaleBarWidth = Math.max(48, Math.min(Math.round(scaleMeters / metersPerPixel), 120));
  const scaleLabel = scaleMeters >= 1000 ? `${scaleMeters / 1000} km` : `${scaleMeters} m`;
  const scaleHalfLabel =
    scaleMeters >= 1000 ? `${scaleMeters / 2000} km` : `${scaleMeters / 2} m`;

  // Trigger file download helper
  const triggerFileDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Build screenshot metadata & capture high-resolution image blob
  const captureScreenshotBlob = async (): Promise<{
    blob: Blob;
    fileName: string;
    shareTitle: string;
    shareText: string;
  }> => {
    if (!captureAreaRef.current) {
      throw new Error('Capture area element is not available');
    }

    // Capture using toBlob with 2x pixel ratio for high-resolution PNG on mobile & retina
    const blob = await toBlob(captureAreaRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: true,
      filter: (node: HTMLElement) => {
        // Exclude unwanted floating buttons or tooltips during capture
        if (node.classList && node.classList.contains('no-screenshot')) {
          return false;
        }
        return true;
      },
    });

    if (!blob) {
      throw new Error('Could not render screenshot image blob');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `qatar_survey_map_${timestamp}.png`;

    const lat = displayCoords?.lat ? displayCoords.lat.toFixed(6) : '25.285400';
    const lng = displayCoords?.lng ? displayCoords.lng.toFixed(6) : '51.531000';
    const dms = displayCoords?.dms?.combined || '';
    const east = displayCoords?.qnd?.formattedEasting || '';
    const north = displayCoords?.qnd?.formattedNorthing || '';
    const locName = displayCoords?.label || (pinnedCoords?.label || 'Inspected Point');

    const shareTitle = 'Qatar Survey Coordinates & Map View';
    const shareText = `📍 Location: ${locName}\n🌐 WGS84 (DD): ${lat}°, ${lng}°\n🧭 WGS84 (DMS): ${dms}\n📐 QND95 (Grid): Easting ${east} m, Northing ${north} m\n🗺️ Geodetic Reference: EPSG:2932 (Qatar National Grid) / EPSG:4326 (WGS84)\n\n⚠️ Disclaimer: This screenshot is for reference only. Coordinate accuracy depends on the source data and transformation parameters. It is not a substitute for verified survey data or official engineering drawings. The application and developer accept no responsibility for errors or losses arising from the use of these coordinates. Always verify coordinates before use in surveying or engineering works.`;

    return { blob, fileName, shareTitle, shareText };
  };

  // WhatsApp Screenshot Sharing
  const handleShareToWhatsApp = async () => {
    setIsCapturing(true);
    try {
      const { blob, fileName, shareTitle, shareText } = await captureScreenshotBlob();
      const imageFile = new File([blob], fileName, { type: 'image/png' });

      // Verify Web Share API file sharing support
      if (
        navigator.canShare &&
        navigator.canShare({ files: [imageFile] })
      ) {
        // Native sharing menu (Android, iOS, supported desktop)
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [imageFile],
        });
        showNotification('Native share menu opened.');
      } else {
        // Fallback for desktop or environments without file sharing support
        const previewUrl = URL.createObjectURL(blob);
        triggerFileDownload(blob, fileName);
        setFallbackModalData({
          blob,
          imageUrl: previewUrl,
          fileName,
          shareText,
        });
        showNotification('Screenshot saved. Ready to share via WhatsApp.');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Share screenshot failed:', error);
        showNotification('Downloading screenshot directly...');
        try {
          const { blob, fileName, shareText } = await captureScreenshotBlob();
          const previewUrl = URL.createObjectURL(blob);
          triggerFileDownload(blob, fileName);
          setFallbackModalData({
            blob,
            imageUrl: previewUrl,
            fileName,
            shareText,
          });
        } catch {
          // secondary catch
        }
      }
    } finally {
      setIsCapturing(false);
    }
  };

  // Direct manual download
  const handleDirectDownloadScreenshot = async () => {
    setIsCapturing(true);
    try {
      const { blob, fileName } = await captureScreenshotBlob();
      triggerFileDownload(blob, fileName);
      showNotification(`Saved "${fileName}"`);
    } catch (err: any) {
      console.error('Screenshot download error', err);
      showNotification('Screenshot generation failed. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="space-y-2 pb-2">
      {/* Map Control Bar & Quick Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-2 sm:p-2.5 shadow-2xs border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        {/* Layer Selector: OpenStreetMap vs Satellite Image Map */}
        <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => handleSwitchLayer('osm')}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
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
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeLayer === 'satellite'
                ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Satellite Image</span>
          </button>
        </div>

        {/* Auxiliary Controls & WhatsApp Share Button */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {activeLayer === 'satellite' && (
            <button
              type="button"
              onClick={toggleSatelliteLabels}
              className={`px-2 py-0.5 sm:py-1 text-xs font-medium rounded-lg border transition-colors ${
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
            className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium cursor-pointer"
          >
            <Navigation className={`w-3.5 h-3.5 text-blue-500 ${isLocating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">My GPS</span>
          </button>

          <button
            type="button"
            onClick={handleResetToQatar}
            title="Reset to whole Qatar extent"
            className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Qatar Extent</span>
          </button>

          {/* Download Screenshot PNG Button */}
          <button
            type="button"
            onClick={handleDirectDownloadScreenshot}
            disabled={isCapturing}
            title="Download high-resolution map and coordinates screenshot"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-medium cursor-pointer transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Screenshot</span>
          </button>

          {/* Primary Action: Share Screenshot to WhatsApp */}
          <button
            type="button"
            onClick={handleShareToWhatsApp}
            disabled={isCapturing}
            title="Capture high-quality screenshot and share directly to WhatsApp"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold shadow-2xs hover:shadow transition-all cursor-pointer disabled:opacity-60 active:scale-95"
          >
            {isCapturing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <WhatsAppIcon className="w-3.5 h-3.5" />
            )}
            <span>{isCapturing ? 'Capturing...' : 'Share to WhatsApp'}</span>
          </button>
        </div>
      </div>

      {/* High-Resolution Screenshot Capture Container */}
      <div
        ref={captureAreaRef}
        className="space-y-2 p-1.5 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs"
      >
        {/* Screenshot Branding & Coordinate Header (included in high-res capture) */}
        <div className="p-2 sm:p-2.5 rounded-lg bg-gradient-to-r from-[#8A1538] via-[#660C26] to-[#360412] text-white flex items-center justify-between gap-2 shadow-xs border border-[#8A1538]/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full p-0.5 bg-white/10 border border-amber-400/50 shrink-0">
              <QatarCompassLogo className="w-full h-full" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[11px] sm:text-xs font-black tracking-wide uppercase leading-tight truncate text-white">
                Qatar QND95 / WGS84 Survey Coordinates
              </h2>
              <p className="text-[9.5px] sm:text-[10px] text-amber-200/95 leading-tight truncate font-medium">
                EPSG:2932 (Qatar National Grid) &bull; EPSG:4326 (WGS84) &bull; CGIS Datum
              </p>
            </div>
          </div>

          <div className="text-right text-[10px] sm:text-[10.5px] font-mono text-white/95 shrink-0 pl-1.5">
            <div className="font-bold text-amber-300">
              {displayCoords?.label || (pinnedCoords?.label || 'Selected Location')}
            </div>
            <div className="text-[9px] sm:text-[9.5px] text-white/70">
              {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Map Card Container */}
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xs bg-slate-900">
          {/* Map Canvas */}
          <div
            ref={mapContainerRef}
            className="w-full h-[46vh] sm:h-[62vh] min-h-[330px] sm:min-h-[440px] max-h-[720px] cursor-crosshair-map"
            onMouseEnter={() => setIsHoveringMap(true)}
            onMouseLeave={() => setIsHoveringMap(false)}
          />

          {/* Floating In-Map Overlays */}
          <div className="absolute top-2 left-2 z-[400] flex flex-col gap-1 pointer-events-none">
            {/* Active Mode Tag */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-white text-[10.5px] font-medium border border-white/10 shadow-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeLayer === 'satellite' ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <span>
                {activeLayer === 'satellite' ? 'Satellite View Active' : 'OpenStreetMap Active'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/60 backdrop-blur-xs text-[9.5px] text-slate-300">
              <span>Move cursor or tap to read coordinates</span>
            </div>
          </div>

          {/* Pin Label toggle: WGS84 or QND95 */}
          <div className="absolute bottom-2 left-2 z-[400] bg-slate-900/90 backdrop-blur-md p-0.5 rounded-lg border border-white/20 shadow-lg flex items-center">
            <div className="flex items-center bg-slate-800/95 rounded-md p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => handleSetPinLabelMode('wgs84')}
                title="Display pin label as WGS84 coordinates on the map pin"
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
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
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
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

          {/* Cartographic North Arrow & Graphic Scale positioned above bottom-right map credentials */}
          <div className="absolute bottom-8 sm:bottom-7.5 right-2 sm:right-2.5 z-[400] flex items-center gap-2 sm:gap-2.5 bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-lg border border-white/20 shadow-lg text-white pointer-events-none select-none">
            {/* Surveyor North Arrow Symbol */}
            <div className="flex flex-col items-center">
              <svg width="20" height="28" viewBox="0 0 22 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow">
                <text x="11" y="6.5" fill="#FFFFFF" fontSize="6.5" fontWeight="900" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif">
                  N
                </text>
                <polygon points="11,8 7,19 11,17" fill="#EF4444" />
                <polygon points="11,8 15,19 11,17" fill="#FFFFFF" />
                <polygon points="11,29 7,17 11,19" fill="#64748B" />
                <polygon points="11,29 15,17 11,19" fill="#94A3B8" />
                <circle cx="11" cy="18" r="1.5" fill="#FDE047" stroke="#0F172A" strokeWidth="0.5" />
              </svg>
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-white/20" />

            {/* Graphic Metric Scale */}
            <div className="flex flex-col items-center min-w-[58px]">
              <div className="flex justify-between w-full text-[7.5px] font-mono leading-none mb-0.5 text-slate-200">
                <span>0</span>
                <span>{scaleHalfLabel}</span>
                <span>{scaleLabel}</span>
              </div>
              {/* Alternating Subdivided Scale Bar */}
              <div
                className="flex h-1.5 border border-white/70 rounded-xs overflow-hidden shadow-xs"
                style={{ width: `${scaleBarWidth}px` }}
              >
                <div className="w-1/2 bg-white" />
                <div className="w-1/2 bg-slate-900 border-l border-white/50" />
              </div>
              <span className="text-[7px] uppercase tracking-wider text-slate-300 font-bold mt-0.5">
                Scale (Metric)
              </span>
            </div>
          </div>
        </div>

        {/* Survey Reference Disclaimer (immediately below the map) */}
        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 text-[9.5px] sm:text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
          <p>
            <strong className="font-bold text-slate-900 dark:text-slate-100">Disclaimer:</strong> This screenshot is for reference only. Coordinate accuracy depends on the source data and transformation parameters. It is not a substitute for verified survey data or official engineering drawings. The application and developer accept no responsibility for errors or losses arising from the use of these coordinates. Always verify coordinates before use in surveying or engineering works.
          </p>
        </div>

        {/* Real-time Coordinate Display Box */}
        <div
          className={`rounded-xl p-2.5 sm:p-3 transition-all duration-200 border ${
            activeLayer === 'satellite'
              ? 'bg-gradient-to-b from-slate-900 to-slate-950 text-white border-cyan-500/40 shadow-md shadow-cyan-950/20'
              : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-2xs'
          }`}
        >
          {/* Panel Header with Inspection Labels and Utility Buttons (included in screenshot) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-slate-200 dark:border-slate-800/80 mb-1.5">
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
                <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 leading-tight">
                  <span>Map Inspection Coordinates</span>
                  {activeLayer === 'satellite' && (
                    <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Satellite
                    </span>
                  )}
                </h3>
                <p
                  className={`text-[10px] sm:text-[10.5px] leading-tight ${
                    activeLayer === 'satellite'
                      ? 'text-cyan-200/70'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Coordinates at cursor position or pinned location
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            {displayCoords && (
              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
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
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
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
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer transition-colors"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              {/* 1. WGS84 Decimal Degrees */}
              <div
                className={`p-2 sm:p-2.5 rounded-lg border ${
                  activeLayer === 'satellite'
                    ? 'bg-slate-800/80 border-slate-700'
                    : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-[10.5px] font-bold uppercase tracking-wider ${
                      activeLayer === 'satellite' ? 'text-blue-400' : 'text-blue-600 dark:text-blue-400'
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
                    <span className="text-[10.5px] text-slate-400">Lat:</span>
                    <span className="font-bold text-blue-500 dark:text-blue-400">
                      {displayCoords.lat >= 0
                        ? `${displayCoords.lat.toFixed(6)}° N`
                        : `${Math.abs(displayCoords.lat).toFixed(6)}° S`}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10.5px] text-slate-400">Lng:</span>
                    <span className="font-bold text-blue-500 dark:text-blue-400">
                      {displayCoords.lng >= 0
                        ? `${displayCoords.lng.toFixed(6)}° E`
                        : `${Math.abs(displayCoords.lng).toFixed(6)}° W`}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-0.5 border-t border-slate-200/50 dark:border-slate-700/50 text-[10.5px]">
                    <span className="text-slate-400">DMS:</span>
                    <span className="text-slate-600 dark:text-slate-300 truncate max-w-[220px]">
                      {displayCoords.dms.combined}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Qatar National Grid (QND95 - EPSG:2932) */}
              <div
                className={`p-2 sm:p-2.5 rounded-lg border ${
                  activeLayer === 'satellite'
                    ? 'bg-slate-800/80 border-cyan-500/30'
                    : 'bg-slate-50 dark:bg-slate-850 border-emerald-200 dark:border-emerald-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-[10.5px] font-bold uppercase tracking-wider ${
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
                    <span className="text-[10.5px] text-slate-400">Easting (X):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {displayCoords.qnd.formattedEasting}{' '}
                      <span className="text-[9.5px] font-normal text-slate-400">m</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10.5px] text-slate-400">Northing (Y):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {displayCoords.qnd.formattedNorthing}{' '}
                      <span className="text-[9.5px] font-normal text-slate-400">m</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-0.5 border-t border-slate-200/50 dark:border-slate-700/50 text-[10.5px]">
                    <span className="text-slate-400">Datum:</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      Hayford 1924 / EPSG:2932
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-3 text-xs text-slate-400">
              Hover over the map or tap any location to inspect coordinates.
            </div>
          )}

          {/* Territory Status */}
          {displayCoords && !isWithinQatarBounds(displayCoords.lat, displayCoords.lng) && (
            <div className="mt-2 text-[10.5px] text-amber-400 flex items-center gap-1.5 bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-800/40">
              <span>Pointer is outside Qatar territory. QND95 calculation projected from central origin.</span>
            </div>
          )}
        </div>

        {/* Geodetic Reference Watermark in Screenshot */}
        <div className="px-2.5 py-1 text-[9px] sm:text-[9.5px] text-slate-400 dark:text-slate-500 font-mono flex flex-wrap items-center justify-between gap-1 border-t border-slate-100 dark:border-slate-800">
          <span>Qatar Center for GIS (CGIS) Datum &bull; EPSG:2932 (QND95) / EPSG:4326 (WGS84)</span>
          <span>Generated via Qatar Geodetic Converter (Client-Side)</span>
        </div>
      </div>

      {/* Fallback Sharing / Download Modal (When device/browser file sharing is restricted) */}
      {fallbackModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl max-w-lg w-full p-3.5 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[#25D366]">
                <WhatsAppIcon className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Share Screenshot to WhatsApp
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFallbackModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Screenshot captured successfully!</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Direct file attachment is restricted by your browser. The high-resolution PNG screenshot has been saved to your downloads. You can attach it directly to WhatsApp chats.
              </p>
            </div>

            {/* Image Preview */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-500">Screenshot Preview:</div>
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 max-h-56 overflow-y-auto">
                <img
                  src={fallbackModalData.imageUrl}
                  alt="Captured Qatar Survey Map and Coordinates"
                  className="w-full object-contain"
                />
              </div>
            </div>

            {/* Coordinate text snippet */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-500">Coordinate Summary:</div>
              <pre className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {fallbackModalData.shareText}
              </pre>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(fallbackModalData.shareText, 'share-text-copy');
                  showNotification('Coordinates copied to clipboard.');
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Copy Text
              </button>

              <button
                type="button"
                onClick={() => triggerFileDownload(fallbackModalData.blob, fallbackModalData.fileName)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(fallbackModalData.shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                <span>Open WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Toast */}
      {shareToast && (
        <div className="fixed bottom-16 sm:bottom-12 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold shadow-xl border border-slate-700 backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-3.5 h-3.5 text-[#25D366]" />
          <span>{shareToast}</span>
        </div>
      )}
    </div>
  );
};

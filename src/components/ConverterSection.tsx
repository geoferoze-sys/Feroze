import React, { useState } from 'react';
import {
  Compass,
  ArrowRight,
  Copy,
  Check,
  MapPin,
  RotateCcw,
  Navigation,
  Sparkles,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  Search,
  Plus,
  Trash2,
  X,
  Loader2,
  ChevronDown,
  BookmarkPlus,
} from 'lucide-react';
import { DmsInput } from './DmsInput';
import {
  wgs84ToQnd95,
  qnd95ToWgs84,
  ddToDmsPart,
  dmsPartToDd,
  formatLatLngDMS,
  isWithinQatarBounds,
  isWithinQatarGridBounds,
  QATAR_PRESETS,
} from '../utils/coordinateConverter';
import {
  DmsPart,
  Qnd95Coord,
  LatLngDD,
  LatLngDMS,
  QatarLocationPreset,
} from '../types/coordinates';

interface ConverterSectionProps {
  onViewOnMap: (lat: number, lng: number, label?: string) => void;
  initialWgsCoords?: { lat: number; lng: number } | null;
  initialQndCoords?: { easting: number; northing: number } | null;
}

export const ConverterSection: React.FC<ConverterSectionProps> = ({
  onViewOnMap,
  initialWgsCoords,
  initialQndCoords,
}) => {
  // Active Conversion Direction: 'WGS_TO_QND' or 'QND_TO_WGS'
  const [conversionMode, setConversionMode] = useState<'WGS_TO_QND' | 'QND_TO_WGS'>('WGS_TO_QND');

  // --- Direction 1: WGS84 -> QND95 State ---
  const [wgsInputFormat, setWgsInputFormat] = useState<'DD' | 'DMS'>('DD');
  // Decimal Degrees state
  const [wgsLatDD, setWgsLatDD] = useState<string>(
    initialWgsCoords ? initialWgsCoords.lat.toFixed(6) : '25.285400'
  );
  const [wgsLngDD, setWgsLngDD] = useState<string>(
    initialWgsCoords ? initialWgsCoords.lng.toFixed(6) : '51.531000'
  );

  // DMS state
  const [wgsLatDMS, setWgsLatDMS] = useState<DmsPart>(
    initialWgsCoords
      ? ddToDmsPart(initialWgsCoords.lat, true)
      : { deg: 25, min: 17, sec: 7.44, dir: 'N' }
  );
  const [wgsLngDMS, setWgsLngDMS] = useState<DmsPart>(
    initialWgsCoords
      ? ddToDmsPart(initialWgsCoords.lng, false)
      : { deg: 51, min: 31, sec: 51.6, dir: 'E' }
  );

  // Output for WGS84 -> QND95
  const [qndOutput, setQndOutput] = useState<Qnd95Coord | null>(null);
  const [wgsToQndError, setWgsToQndError] = useState<string | null>(null);
  const [wgsConvertedInput, setWgsConvertedInput] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // --- Direction 2: QND95 -> WGS84 State ---
  const [qndEastingInput, setQndEastingInput] = useState<string>(
    initialQndCoords ? initialQndCoords.easting.toFixed(3) : '231735.610'
  );
  const [qndNorthingInput, setQndNorthingInput] = useState<string>(
    initialQndCoords ? initialQndCoords.northing.toFixed(3) : '392498.417'
  );

  // Output for QND95 -> WGS84
  const [wgsOutput, setWgsOutput] = useState<{
    dd: LatLngDD;
    dms: LatLngDMS;
    formattedDD: string;
  } | null>(null);
  const [qndToWgsError, setQndToWgsError] = useState<string | null>(null);

  // Clipboard copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Location detection status
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // User custom preset locations & drop list state
  const [userCustomPresets, setUserCustomPresets] = useState<QatarLocationPreset[]>(() => {
    try {
      const saved = localStorage.getItem('qnd95_user_locations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'search' | 'manual' | 'history'>('search');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<
    Array<{
      place_id: number | string;
      name: string;
      display_name: string;
      lat: number;
      lng: number;
    }>
  >([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saveCurrentName, setSaveCurrentName] = useState<string>('');
  const [saveCurrentCategory, setSaveCurrentCategory] = useState<string>('Custom Site');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  const saveUserPreset = (preset: QatarLocationPreset) => {
    setUserCustomPresets((prev) => {
      const updated = [preset, ...prev.filter((p) => p.id !== preset.id)];
      try {
        localStorage.setItem('qnd95_user_locations', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save to localStorage', e);
      }
      return updated;
    });
    showToast(`Added "${preset.name}" to presets.`);
  };

  const deleteUserPreset = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUserCustomPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('qnd95_user_locations', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update localStorage', e);
      }
      return updated;
    });
    if (selectedPresetId === id) {
      setSelectedPresetId('');
    }
    showToast('Removed location from presets.');
  };

  const clearAllUserPresets = () => {
    if (userCustomPresets.length === 0) return;
    if (window.confirm(`Clear all ${userCustomPresets.length} user-added & searched locations?`)) {
      setUserCustomPresets([]);
      try {
        localStorage.removeItem('qnd95_user_locations');
      } catch (e) {
        console.error('Failed to clear localStorage', e);
      }
      if (userCustomPresets.some((p) => p.id === selectedPresetId)) {
        setSelectedPresetId('');
      }
      showToast('Cleared user added & searched locations history.');
    }
  };

  const [removedPresetIds, setRemovedPresetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('qnd95_removed_preset_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleDeletePreset = (preset: QatarLocationPreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (preset.isCustom) {
      deleteUserPreset(preset.id);
    } else {
      setRemovedPresetIds((prev) => {
        const updated = [...prev, preset.id];
        try {
          localStorage.setItem('qnd95_removed_preset_ids', JSON.stringify(updated));
        } catch (err) {
          console.error('Failed to update localStorage', err);
        }
        return updated;
      });
      if (selectedPresetId === preset.id) {
        setSelectedPresetId('');
      }
      showToast(`Removed "${preset.name}" from presets.`);
    }
  };

  const handleRestoreOfficialPresets = () => {
    setRemovedPresetIds([]);
    try {
      localStorage.removeItem('qnd95_removed_preset_ids');
    } catch (err) {
      console.error('Failed to reset localStorage', err);
    }
    showToast('Restored all Qatar landmark presets.');
  };

  const visibleOfficialPresets = QATAR_PRESETS.filter(
    (preset) => !removedPresetIds.includes(preset.id)
  );
  const sortedOfficialPresets = [...visibleOfficialPresets].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );
  const allPresets: QatarLocationPreset[] = [...userCustomPresets, ...sortedOfficialPresets];
  const activeSelectedPreset = allPresets.find((p) => p.id === selectedPresetId);

  const handleSelectPreset = (presetId: string) => {
    if (presetId === '__CLEAR_USER_HISTORY__') {
      clearAllUserPresets();
      return;
    }
    if (presetId === '__OPEN_ADD_SEARCH_MODAL__') {
      setShowAddModal(true);
      setSearchError(null);
      return;
    }
    setSelectedPresetId(presetId);
    if (!presetId) return;
    const preset = allPresets.find((p) => p.id === presetId);
    if (preset) {
      applyPresetToWgs(preset);
      applyPresetToQnd(preset);
      showToast(`Loaded ${preset.name}`);
    }
  };

  const handleSearchLocations = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&countrycodes=qa&limit=8`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        setSearchError('No locations found in Qatar for this search query. Try another keyword.');
        setSearchResults([]);
      } else {
        setSearchResults(
          data.map((item: any) => ({
            place_id: item.place_id,
            name: item.name || item.display_name.split(',')[0],
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          }))
        );
      }
    } catch {
      setSearchError('Search failed. Please check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSearchResult = (result: {
    name: string;
    display_name: string;
    lat: number;
    lng: number;
  }) => {
    const qnd = wgs84ToQnd95(result.lat, result.lng);
    const newPreset: QatarLocationPreset = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: result.name,
      category: 'Searched Place',
      lat: result.lat,
      lng: result.lng,
      easting: qnd.easting,
      northing: qnd.northing,
      description: result.display_name,
      isCustom: true,
    };
    saveUserPreset(newPreset);
    setSelectedPresetId(newPreset.id);
    applyPresetToWgs(newPreset);
    applyPresetToQnd(newPreset);
    setShowAddModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSaveCurrentCoordinates = () => {
    if (!saveCurrentName.trim()) return;
    let lat: number;
    let lng: number;

    if (wgsInputFormat === 'DD') {
      lat = parseFloat(wgsLatDD);
      lng = parseFloat(wgsLngDD);
    } else {
      lat = dmsPartToDd(wgsLatDMS);
      lng = dmsPartToDd(wgsLngDMS);
    }

    if (isNaN(lat) || isNaN(lng)) {
      showToast('Current coordinates are invalid.');
      return;
    }

    const qnd = wgs84ToQnd95(lat, lng);
    const newPreset: QatarLocationPreset = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: saveCurrentName.trim(),
      category: saveCurrentCategory || 'Survey Point',
      lat,
      lng,
      easting: qnd.easting,
      northing: qnd.northing,
      description: `Saved from converter (Lat: ${lat.toFixed(5)}, Lon: ${lng.toFixed(5)})`,
      isCustom: true,
    };
    saveUserPreset(newPreset);
    setSelectedPresetId(newPreset.id);
    setShowAddModal(false);
    setSaveCurrentName('');
  };

  // Initial auto-conversion on mount so user sees immediate results
  React.useEffect(() => {
    const initialLat = initialWgsCoords ? initialWgsCoords.lat : 25.2854;
    const initialLng = initialWgsCoords ? initialWgsCoords.lng : 51.531;
    const qnd = wgs84ToQnd95(initialLat, initialLng);
    setQndOutput(qnd);
    setWgsConvertedInput({ lat: initialLat, lng: initialLng });

    const initialE = initialQndCoords ? initialQndCoords.easting : 231735.610;
    const initialN = initialQndCoords ? initialQndCoords.northing : 392498.417;
    const wgs = qnd95ToWgs84(initialE, initialN);
    setWgsOutput(wgs);
  }, []);

  // Sync when initialWgsCoords is updated from the interactive map
  React.useEffect(() => {
    if (initialWgsCoords) {
      setWgsLatDD(initialWgsCoords.lat.toFixed(6));
      setWgsLngDD(initialWgsCoords.lng.toFixed(6));
      setWgsLatDMS(ddToDmsPart(initialWgsCoords.lat, true));
      setWgsLngDMS(ddToDmsPart(initialWgsCoords.lng, false));
      const qnd = wgs84ToQnd95(initialWgsCoords.lat, initialWgsCoords.lng);
      setQndOutput(qnd);
      setWgsConvertedInput({ lat: initialWgsCoords.lat, lng: initialWgsCoords.lng });
      setWgsToQndError(null);
    }
  }, [initialWgsCoords]);

  // Sync when initialQndCoords is provided
  React.useEffect(() => {
    if (initialQndCoords) {
      setQndEastingInput(initialQndCoords.easting.toFixed(3));
      setQndNorthingInput(initialQndCoords.northing.toFixed(3));
      const result = qnd95ToWgs84(initialQndCoords.easting, initialQndCoords.northing);
      setWgsOutput(result);
      setQndToWgsError(null);
    }
  }, [initialQndCoords]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  // Convert WGS84 -> QND95 Handler
  const handleConvertWgsToQnd = () => {
    setWgsToQndError(null);
    let lat: number;
    let lng: number;

    if (wgsInputFormat === 'DD') {
      lat = parseFloat(wgsLatDD);
      lng = parseFloat(wgsLngDD);
      if (isNaN(lat) || isNaN(lng)) {
        setWgsToQndError('Please enter valid numeric latitude and longitude values.');
        return;
      }
    } else {
      lat = dmsPartToDd(wgsLatDMS);
      lng = dmsPartToDd(wgsLngDMS);
    }

    if (lat < -90 || lat > 90) {
      setWgsToQndError('Latitude must be between -90° and +90°.');
      return;
    }
    if (lng < -180 || lng > 180) {
      setWgsToQndError('Longitude must be between -180° and +180°.');
      return;
    }

    try {
      const qnd = wgs84ToQnd95(lat, lng);
      setQndOutput(qnd);
      setWgsConvertedInput({ lat, lng });
    } catch {
      setWgsToQndError('Projection conversion failed. Verify input coordinates.');
    }
  };

  // Convert QND95 -> WGS84 Handler
  const handleConvertQndToWgs = () => {
    setQndToWgsError(null);
    const easting = parseFloat(qndEastingInput);
    const northing = parseFloat(qndNorthingInput);

    if (isNaN(easting) || isNaN(northing)) {
      setQndToWgsError('Please enter valid numeric Easting and Northing values.');
      return;
    }

    if (easting <= 0 || northing <= 0) {
      setQndToWgsError('Easting and Northing must be positive grid coordinates in meters.');
      return;
    }

    try {
      const result = qnd95ToWgs84(easting, northing);
      setWgsOutput(result);
    } catch {
      setQndToWgsError('Projection calculation error. Check grid values.');
    }
  };

  // Switch DD to DMS sync
  const handleToggleWgsFormat = (format: 'DD' | 'DMS') => {
    if (format === wgsInputFormat) return;
    if (format === 'DMS') {
      // Sync from DD to DMS
      const lat = parseFloat(wgsLatDD);
      const lng = parseFloat(wgsLngDD);
      if (!isNaN(lat)) setWgsLatDMS(ddToDmsPart(lat, true));
      if (!isNaN(lng)) setWgsLngDMS(ddToDmsPart(lng, false));
    } else {
      // Sync from DMS to DD
      const lat = dmsPartToDd(wgsLatDMS);
      const lng = dmsPartToDd(wgsLngDMS);
      setWgsLatDD(lat.toFixed(6));
      setWgsLngDD(lng.toFixed(6));
    }
    setWgsInputFormat(format);
  };

  // Fill preset into WGS form
  const applyPresetToWgs = (preset: QatarLocationPreset) => {
    setWgsLatDD(preset.lat.toFixed(6));
    setWgsLngDD(preset.lng.toFixed(6));
    setWgsLatDMS(ddToDmsPart(preset.lat, true));
    setWgsLngDMS(ddToDmsPart(preset.lng, false));
    // Auto convert
    const qnd = wgs84ToQnd95(preset.lat, preset.lng);
    setQndOutput(qnd);
    setWgsConvertedInput({ lat: preset.lat, lng: preset.lng });
    setWgsToQndError(null);
  };

  // Fill preset into QND form
  const applyPresetToQnd = (preset: QatarLocationPreset) => {
    setQndEastingInput(preset.easting.toFixed(3));
    setQndNorthingInput(preset.northing.toFixed(3));
    // Auto convert
    const result = qnd95ToWgs84(preset.easting, preset.northing);
    setWgsOutput(result);
    setQndToWgsError(null);
  };

  // Get current device GPS location
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      setWgsToQndError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setWgsToQndError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setWgsLatDD(lat.toFixed(6));
        setWgsLngDD(lng.toFixed(6));
        setWgsLatDMS(ddToDmsPart(lat, true));
        setWgsLngDMS(ddToDmsPart(lng, false));
        // Auto convert
        const qnd = wgs84ToQnd95(lat, lng);
        setQndOutput(qnd);
        setWgsConvertedInput({ lat, lng });
      },
      (err) => {
        setIsLocating(false);
        setWgsToQndError(`GPS error: ${err.message || 'Unable to retrieve location.'}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Swap direction and transfer existing coordinates
  const handleSwapDirection = () => {
    if (conversionMode === 'WGS_TO_QND') {
      if (qndOutput) {
        setQndEastingInput(qndOutput.easting.toFixed(3));
        setQndNorthingInput(qndOutput.northing.toFixed(3));
        const res = qnd95ToWgs84(qndOutput.easting, qndOutput.northing);
        setWgsOutput(res);
      }
      setConversionMode('QND_TO_WGS');
      showToast('Switched direction to QND95 → WGS84');
    } else {
      if (wgsOutput) {
        setWgsLatDD(wgsOutput.dd.lat.toFixed(6));
        setWgsLngDD(wgsOutput.dd.lng.toFixed(6));
        setWgsLatDMS(wgsOutput.dms.lat);
        setWgsLngDMS(wgsOutput.dms.lng);
        const qnd = wgs84ToQnd95(wgsOutput.dd.lat, wgsOutput.dd.lng);
        setQndOutput(qnd);
        setWgsConvertedInput({ lat: wgsOutput.dd.lat, lng: wgsOutput.dd.lng });
      }
      setConversionMode('WGS_TO_QND');
      showToast('Switched direction to WGS84 → QND95');
    }
  };

  // Transfer output of WGS->QND into QND->WGS input and switch to that mode
  const transferQndOutputToInput = () => {
    if (!qndOutput) return;
    setQndEastingInput(qndOutput.easting.toFixed(3));
    setQndNorthingInput(qndOutput.northing.toFixed(3));
    setConversionMode('QND_TO_WGS');
    handleConvertQndToWgs();
    showToast('Switched to QND95 → WGS84 with result');
  };

  // Transfer output of QND->WGS into WGS->QND input and switch to that mode
  const transferWgsOutputToInput = () => {
    if (!wgsOutput) return;
    setWgsLatDD(wgsOutput.dd.lat.toFixed(6));
    setWgsLngDD(wgsOutput.dd.lng.toFixed(6));
    setWgsLatDMS(wgsOutput.dms.lat);
    setWgsLngDMS(wgsOutput.dms.lng);
    setConversionMode('WGS_TO_QND');
    handleConvertWgsToQnd();
    showToast('Switched to WGS84 → QND95 with result');
  };

  return (
    <div className="space-y-2 sm:space-y-2.5 pb-2">
      {/* Preset Locations Drop List & Search/Add Locations by User */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 sm:p-3 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-1.5 sm:space-y-2">
        {/* Header with Title and Add/Search Button */}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sparkles className="w-3 h-3" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Preset Locations
                </span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                  {allPresets.length} available
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                Choose landmark presets or add custom searched places
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {removedPresetIds.length > 0 && (
              <button
                type="button"
                onClick={handleRestoreOfficialPresets}
                title="Restore default landmark presets"
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Restore Defaults</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setSearchError(null);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <Plus className="w-3 h-3" />
              <span>Add / Search</span>
            </button>
          </div>
        </div>

        {/* Drop List Selector */}
        <div className="relative">
          <select
            value={selectedPresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="w-full h-8 sm:h-8.5 pl-2.5 pr-8 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 appearance-none cursor-pointer transition-all"
          >
            <option value="">-- Choose a Preset Location to Load into Converter --</option>
            {userCustomPresets.length > 0 && (
              <optgroup label="📍 User Added & Searched Locations">
                {userCustomPresets
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
                  .map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      ⭐ {preset.name}{preset.nameAr ? ` (${preset.nameAr})` : ''}
                    </option>
                  ))}
              </optgroup>
            )}
            {sortedOfficialPresets.length > 0 && (
              <optgroup label="🇶🇦 Places in Qatar (A–Z)">
                {sortedOfficialPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}{preset.nameAr ? ` (${preset.nameAr})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Active Selected Preset Details Card */}
        {activeSelectedPreset && (
          <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50/60 dark:bg-slate-850 border border-blue-100 dark:border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px] sm:text-xs">
                  {activeSelectedPreset.name}
                </span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium">
                  {activeSelectedPreset.category}
                </span>
                {activeSelectedPreset.isCustom && (
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                    User Saved
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {activeSelectedPreset.description}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  applyPresetToWgs(activeSelectedPreset);
                  applyPresetToQnd(activeSelectedPreset);
                  showToast(`Reloaded ${activeSelectedPreset.name}`);
                }}
                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-[11px] font-medium cursor-pointer shadow-2xs"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() =>
                  onViewOnMap(
                    activeSelectedPreset.lat,
                    activeSelectedPreset.lng,
                    activeSelectedPreset.name
                  )
                }
                className="px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium cursor-pointer shadow-2xs"
              >
                Map
              </button>
              <button
                type="button"
                onClick={(e) => handleDeletePreset(activeSelectedPreset, e)}
                title={`Delete "${activeSelectedPreset.name}" from presets`}
                className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3 h-3 text-emerald-500" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal: Add & Search Location by User */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl max-w-lg w-full p-3.5 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                      Add Location to Presets
                    </h3>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                      Search any Qatar place or save currently entered coordinates
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Mode Tabs */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('search')}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                    activeModalTab === 'search'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Search Places
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('manual')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    activeModalTab === 'manual'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Save Current
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('history')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    activeModalTab === 'history'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  History ({userCustomPresets.length})
                </button>
              </div>

              {/* Tab 1: Search Online */}
              {activeModalTab === 'search' && (
                <div className="space-y-3">
                  <form onSubmit={handleSearchLocations} className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g. Souq Waqif, Katara, Al Wakrah..."
                        className="w-full h-10 pl-3 pr-8 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isSearching || !searchQuery.trim()}
                      className="px-4 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isSearching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>Search</span>
                    </button>
                  </form>

                  {/* Search Error */}
                  {searchError && (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>{searchError}</span>
                    </div>
                  )}

                  {/* Search Results List */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Found Places in Qatar ({searchResults.length})
                      </span>
                      {searchResults.map((item) => (
                        <div
                          key={item.place_id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 hover:border-blue-400 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {item.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {item.display_name}
                            </p>
                            <span className="font-mono text-[10px] text-slate-400">
                              {item.lat.toFixed(5)}°, {item.lng.toFixed(5)}°
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddSearchResult(item)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add &amp; Load</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Suggested Queries */}
                  <div className="pt-1">
                    <span className="text-[11px] text-slate-400 block mb-1">
                      Quick suggestions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Souq Waqif',
                        'Katara Cultural Village',
                        'Villaggio Mall',
                        'Al Wakrah Souq',
                        'Al Khor Corniche',
                        'Dukhan Beach',
                      ].map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => {
                            setSearchQuery(term);
                          }}
                          className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Save Current / Custom Coordinates */}
              {activeModalTab === 'manual' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Location / Preset Name
                    </label>
                    <input
                      type="text"
                      value={saveCurrentName}
                      onChange={(e) => setSaveCurrentName(e.target.value)}
                      placeholder="e.g. Survey Station Alpha, Tower Site #4"
                      className="w-full h-10 px-3 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Category
                    </label>
                    <select
                      value={saveCurrentCategory}
                      onChange={(e) => setSaveCurrentCategory(e.target.value)}
                      className="w-full h-10 px-3 text-xs sm:text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="Survey Benchmark">Survey Benchmark</option>
                      <option value="Construction Site">Construction Site</option>
                      <option value="Boundary Marker">Boundary Marker</option>
                      <option value="Field Station">Field Station</option>
                      <option value="Custom Landmark">Custom Landmark</option>
                    </select>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Coordinates that will be saved:
                    </span>
                    <div className="font-mono text-slate-600 dark:text-slate-300">
                      {wgsInputFormat === 'DD'
                        ? `WGS84: ${wgsLatDD || '0'}°, ${wgsLngDD || '0'}°`
                        : `WGS84: ${wgsLatDMS.deg}°${wgsLatDMS.min}'${wgsLatDMS.sec}" ${wgsLatDMS.dir}, ${wgsLngDMS.deg}°${wgsLngDMS.min}'${wgsLngDMS.sec}" ${wgsLngDMS.dir}`}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCurrentCoordinates}
                    disabled={!saveCurrentName.trim()}
                    className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Save to Preset Locations Drop List</span>
                  </button>
                </div>
              )}

              {/* Tab 3: History of User Added & Searched Locations */}
              {activeModalTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Saved &amp; Searched Locations ({userCustomPresets.length})
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Locations stored in your browser session &amp; local storage
                      </p>
                    </div>
                    {userCustomPresets.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllUserPresets}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        <span>Clear All History</span>
                      </button>
                    )}
                  </div>

                  {userCustomPresets.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 space-y-1">
                      <MapPin className="w-6 h-6 text-slate-400 mx-auto stroke-1" />
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        No custom or searched locations saved yet
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Search any Qatar landmark online or save your current coordinates.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {userCustomPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {preset.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-medium shrink-0">
                                {preset.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {preset.description}
                            </p>
                            <span className="font-mono text-[10.5px] text-slate-400 block">
                              QND95: E {preset.easting.toFixed(3)} m, N {preset.northing.toFixed(3)} m
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectPreset(preset.id);
                                setShowAddModal(false);
                              }}
                              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={(e) => deleteUserPreset(preset.id, e)}
                              title="Delete location"
                              className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* UNIFIED CONVERTER FRAME: User selects either WGS84-QND95 or QND95-WGS84 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xs border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Frame Direction Switcher Header */}
        <div className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-slate-50 via-blue-50/20 to-slate-50 dark:from-slate-850 dark:via-slate-800 dark:to-slate-850 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Conversion Direction
              </span>
            </div>

            {/* Segmented Direction Selector Buttons */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <div className="flex items-center p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg border border-slate-300/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setConversionMode('WGS_TO_QND')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    conversionMode === 'WGS_TO_QND'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>WGS84</span>
                  <ArrowRight className="w-3 h-3" />
                  <span>QND95</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConversionMode('QND_TO_WGS')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    conversionMode === 'QND_TO_WGS'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>QND95</span>
                  <ArrowRight className="w-3 h-3" />
                  <span>WGS84</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content of the Active Direction */}
        {conversionMode === 'WGS_TO_QND' ? (
          <div className="p-2.5 sm:p-3.5 space-y-2">
            {/* Format Selector: DD vs DMS & GPS button */}
            <div className="flex items-center justify-between pb-0.5 flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Format
                </span>
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleToggleWgsFormat('DD')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                      wgsInputFormat === 'DD'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Decimal Degrees (DD)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleWgsFormat('DMS')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                      wgsInputFormat === 'DMS'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Degrees Min Sec (DMS)
                  </button>
                </div>
              </div>

              {/* GPS Button */}
              <button
                type="button"
                onClick={handleGetDeviceLocation}
                disabled={isLocating}
                title="Use current GPS location"
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                <Navigation className={`w-3 h-3 text-blue-600 ${isLocating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isLocating ? 'Acquiring...' : 'My GPS'}</span>
              </button>
            </div>

            {/* Conditional Input UI: DD vs DMS */}
            {wgsInputFormat === 'DD' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Latitude */}
                <div className="space-y-0.5">
                  <label className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Latitude (°N / °S)</span>
                    <span className="text-[10px] text-slate-400 font-mono">e.g. 25.285400</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={wgsLatDD}
                      onChange={(e) => setWgsLatDD(e.target.value)}
                      placeholder="25.285400"
                      className="w-full h-8 sm:h-8.5 px-2.5 text-xs font-mono font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      °
                    </span>
                  </div>
                </div>

                {/* Longitude */}
                <div className="space-y-0.5">
                  <label className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-300">
                    <span>Longitude (°E / °W)</span>
                    <span className="text-[10px] text-slate-400 font-mono">e.g. 51.531000</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={wgsLngDD}
                      onChange={(e) => setWgsLngDD(e.target.value)}
                      placeholder="51.531000"
                      className="w-full h-8 sm:h-8.5 px-2.5 text-xs font-mono font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      °
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <DmsInput
                  label="Latitude (Degrees, Minutes, Seconds)"
                  isLat={true}
                  value={wgsLatDMS}
                  onChange={setWgsLatDMS}
                />
                <DmsInput
                  label="Longitude (Degrees, Minutes, Seconds)"
                  isLat={false}
                  value={wgsLngDMS}
                  onChange={setWgsLngDMS}
                />
              </div>
            )}

            {/* Validation error if any */}
            {wgsToQndError && (
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:rose-300 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>{wgsToQndError}</span>
              </div>
            )}

            {/* Separate Convert Button 1 */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={handleConvertWgsToQnd}
                className="w-full h-8.5 sm:h-9 flex items-center justify-center gap-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer active:scale-[0.99]"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Convert to QND95 (Qatar National Grid)</span>
              </button>
            </div>

            {/* Separate Output Display 1 */}
            {qndOutput && (
              <div className="mt-2 p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                    QND95 Grid Result (EPSG:2932)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `E: ${qndOutput.easting.toFixed(3)} m, N: ${qndOutput.northing.toFixed(3)} m`,
                        'qnd-combined'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {copiedKey === 'qnd-combined' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy All</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Coordinates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Easting */}
                  <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-[#8A1538] dark:text-[#F43F5E] mb-0.5">
                      <span className="font-semibold text-[#8A1538] dark:text-[#fda4af]">Easting (X)</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(qndOutput.easting.toFixed(3), 'qnd-easting')
                        }
                        className="text-[#8A1538]/70 hover:text-[#8A1538] dark:text-[#fda4af]/70 dark:hover:text-[#fda4af] cursor-pointer"
                        title="Copy Easting"
                      >
                        {copiedKey === 'qnd-easting' ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-sm sm:text-base font-mono font-bold text-[#8A1538] dark:text-[#f43f5e]">
                      {qndOutput.formattedEasting}{' '}
                      <span className="text-[11px] font-normal text-[#8A1538]/80 dark:text-[#fda4af]/80">m</span>
                    </div>
                  </div>

                  {/* Northing */}
                  <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-[#8A1538] dark:text-[#F43F5E] mb-0.5">
                      <span className="font-semibold text-[#8A1538] dark:text-[#fda4af]">Northing (Y)</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(qndOutput.northing.toFixed(3), 'qnd-northing')
                        }
                        className="text-[#8A1538]/70 hover:text-[#8A1538] dark:text-[#fda4af]/70 dark:hover:text-[#fda4af] cursor-pointer"
                        title="Copy Northing"
                      >
                        {copiedKey === 'qnd-northing' ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="text-sm sm:text-base font-mono font-bold text-[#8A1538] dark:text-[#f43f5e]">
                      {qndOutput.formattedNorthing}{' '}
                      <span className="text-[11px] font-normal text-[#8A1538]/80 dark:text-[#fda4af]/80">m</span>
                    </div>
                  </div>
                </div>

                {/* Qatar Bounds Notice */}
                {wgsConvertedInput && !isWithinQatarBounds(wgsConvertedInput.lat, wgsConvertedInput.lng) && (
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span>
                      Note: Coordinates appear outside Qatar national territory (~24.4°N to 26.3°N, 50.6°E to 51.8°E). QND95 grid is calculated using official projection parameters.
                    </span>
                  </div>
                )}

                {/* Action Buttons for Result 1 */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {wgsConvertedInput && (
                    <button
                      type="button"
                      onClick={() =>
                        onViewOnMap(
                          wgsConvertedInput.lat,
                          wgsConvertedInput.lng
                        )
                      }
                      className="flex-1 min-w-[120px] h-7.5 sm:h-8 flex items-center justify-center gap-1 px-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 text-blue-500" />
                      <span>View on Map</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={transferQndOutputToInput}
                    className="flex-1 min-w-[120px] h-7.5 sm:h-8 flex items-center justify-center gap-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    <span>Switch to QND95 → WGS84</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5 sm:p-3.5 space-y-2">
            {/* Header row with Reset */}
            <div className="flex items-center justify-between pb-0.5">
              <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Enter Grid Values (Meters)
              </span>
              <button
                type="button"
                onClick={() => {
                  setQndEastingInput('');
                  setQndNorthingInput('');
                  setWgsOutput(null);
                  setQndToWgsError(null);
                }}
                title="Clear input"
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Easting Input */}
              <div className="space-y-0.5">
                <label className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>Easting / X (meters)</span>
                  <span className="text-[10px] text-slate-400 font-mono">e.g. 231735.610</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    inputMode="decimal"
                    value={qndEastingInput}
                    onChange={(e) => setQndEastingInput(e.target.value)}
                    placeholder="231735.610"
                    className="w-full h-8 sm:h-8.5 px-2.5 text-xs font-mono font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    m
                  </span>
                </div>
              </div>

              {/* Northing Input */}
              <div className="space-y-0.5">
                <label className="flex items-center justify-between text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>Northing / Y (meters)</span>
                  <span className="text-[10px] text-slate-400 font-mono">e.g. 392498.417</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    inputMode="decimal"
                    value={qndNorthingInput}
                    onChange={(e) => setQndNorthingInput(e.target.value)}
                    placeholder="392498.417"
                    className="w-full h-8 sm:h-8.5 px-2.5 text-xs font-mono font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    m
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message 2 */}
            {qndToWgsError && (
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>{qndToWgsError}</span>
              </div>
            )}

            {/* Separate Convert Button 2 */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={handleConvertQndToWgs}
                className="w-full h-8.5 sm:h-9 flex items-center justify-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer active:scale-[0.99]"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Convert to WGS84 (DD & DMS)</span>
              </button>
            </div>

            {/* Separate Output Display 2 */}
            {wgsOutput && (
              <div className="mt-2 p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                    WGS84 Coordinates Result (EPSG:4326)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `DD: ${wgsOutput.formattedDD} | DMS: ${wgsOutput.dms.combined}`,
                        'wgs-all'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {copiedKey === 'wgs-all' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Both</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Display Format 1: Decimal Degrees (DD) */}
                <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Decimal Degrees (DD)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `${wgsOutput.dd.lat.toFixed(6)}, ${wgsOutput.dd.lng.toFixed(6)}`,
                          'wgs-dd'
                        )
                      }
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                    >
                      {copiedKey === 'wgs-dd' ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy DD</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800">
                      <span className="text-[9.5px] font-medium text-slate-400 block font-sans">
                        Latitude
                      </span>
                      {wgsOutput.dd.lat.toFixed(6)}°
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800">
                      <span className="text-[9.5px] font-medium text-slate-400 block font-sans">
                        Longitude
                      </span>
                      {wgsOutput.dd.lng.toFixed(6)}°
                    </div>
                  </div>
                </div>

                {/* Display Format 2: Degrees, Minutes, Seconds (DMS) */}
                <div className="p-2 sm:p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Degrees, Minutes, Seconds (DMS)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(wgsOutput.dms.combined, 'wgs-dms')
                      }
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                    >
                      {copiedKey === 'wgs-dms' ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy DMS</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800">
                      <span className="text-[9.5px] font-medium text-slate-400 block font-sans">
                        Latitude DMS
                      </span>
                      {wgsOutput.dms.formattedLat}
                    </div>
                    <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-800">
                      <span className="text-[9.5px] font-medium text-slate-400 block font-sans">
                        Longitude DMS
                      </span>
                      {wgsOutput.dms.formattedLng}
                    </div>
                  </div>
                </div>

                {/* Grid bounds notice */}
                {!isWithinQatarGridBounds(
                  parseFloat(qndEastingInput),
                  parseFloat(qndNorthingInput)
                ) && (
                  <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span>
                      Note: Easting/Northing falls outside standard Qatar land bounds (E: ~135,000–265,000m, N: ~295,000–505,000m).
                    </span>
                  </div>
                )}

                {/* Action Buttons for Result 2 */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      onViewOnMap(
                        wgsOutput.dd.lat,
                        wgsOutput.dd.lng
                      )
                    }
                    className="flex-1 min-w-[120px] h-7.5 sm:h-8 flex items-center justify-center gap-1 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    <span>View on Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={transferWgsOutputToInput}
                    className="flex-1 min-w-[120px] h-7.5 sm:h-8 flex items-center justify-center gap-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    <span>Switch to WGS84 → QND95</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

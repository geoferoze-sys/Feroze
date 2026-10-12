import React, { useState } from 'react';
import {
  Sun,
  Moon,
  Laptop,
  Languages,
  Sliders,
  Shield,
  Trash2,
  RotateCcw,
  Plus,
  Check,
  AlertTriangle,
  Bookmark,
  MapPin,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  AppSettings,
  AppLanguage,
  ThemePreference,
  ThousandsSeparator,
  MapLayerDefault,
  MapExtentDefault,
  DEFAULT_SETTINGS,
} from '../types/settings';
import { QatarLocationPreset } from '../types/coordinates';
import { getTranslation } from '../utils/i18n';
import { wgs84ToQnd95 } from '../utils/coordinateConverter';

interface SettingsSectionProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetSettings: () => void;
  onClearAllData: () => void;
  customPresets: QatarLocationPreset[];
  onAddCustomPreset: (preset: QatarLocationPreset) => void;
  onDeleteCustomPreset: (presetId: string) => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onClearAllData,
  customPresets,
  onAddCustomPreset,
  onDeleteCustomPreset,
}) => {
  const t = getTranslation(settings.language);

  // Dialog modals
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showAddPresetModal, setShowAddPresetModal] = useState<boolean>(false);

  // New preset form state
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [newPresetNameAr, setNewPresetNameAr] = useState<string>('');
  const [newPresetCategory, setNewPresetCategory] = useState<string>('Custom');
  const [newPresetLat, setNewPresetLat] = useState<string>('25.285400');
  const [newPresetLng, setNewPresetLng] = useState<string>('51.531000');
  const [newPresetDesc, setNewPresetDesc] = useState<string>('');
  const [presetFormError, setPresetFormError] = useState<string | null>(null);

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(newPresetLat);
    const lng = parseFloat(newPresetLng);

    if (!newPresetName.trim()) {
      setPresetFormError('Please provide a name for this location.');
      return;
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setPresetFormError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setPresetFormError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    try {
      const qnd = wgs84ToQnd95(lat, lng);
      const newPreset: QatarLocationPreset = {
        id: `custom_${Date.now()}`,
        name: newPresetName.trim(),
        nameAr: newPresetNameAr.trim() || undefined,
        category: newPresetCategory.trim() || 'Custom',
        lat,
        lng,
        easting: qnd.easting,
        northing: qnd.northing,
        description: newPresetDesc.trim() || 'User custom survey point',
        isCustom: true,
      };

      onAddCustomPreset(newPreset);
      setShowAddPresetModal(false);
      setNewPresetName('');
      setNewPresetNameAr('');
      setNewPresetDesc('');
      setPresetFormError(null);
    } catch (err) {
      setPresetFormError('Could not project coordinates to QND95.');
    }
  };

  return (
    <div className="space-y-2.5 pb-3">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-0.5">
        <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
          {t.settingsTitle}
        </h2>
        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
          {t.settingsSubtitle}
        </p>
      </div>

      {/* 1. Appearance / Theme */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {t.appearanceSection}
            </h3>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {t.appearanceDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Light Mode */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'light' })}
            className={`p-2 sm:p-2.5 rounded-lg border flex items-center gap-2.5 transition-all cursor-pointer ${
              settings.theme === 'light'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <div className="p-1.5 rounded-md bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Sun className="w-3.5 h-3.5" />
            </div>
            <div className="text-left rtl:text-right">
              <div className="text-xs font-bold">{t.themeLight}</div>
              <div className="text-[10px] text-slate-400">Daytime clarity</div>
            </div>
          </button>

          {/* Dark Mode */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            className={`p-2 sm:p-2.5 rounded-lg border flex items-center gap-2.5 transition-all cursor-pointer ${
              settings.theme === 'dark'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <div className="p-1.5 rounded-md bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Moon className="w-3.5 h-3.5" />
            </div>
            <div className="text-left rtl:text-right">
              <div className="text-xs font-bold">{t.themeDark}</div>
              <div className="text-[10px] text-slate-400">Field night mode</div>
            </div>
          </button>

          {/* System Theme */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'system' })}
            className={`p-2 sm:p-2.5 rounded-lg border flex items-center gap-2.5 transition-all cursor-pointer ${
              settings.theme === 'system'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <div className="p-1.5 rounded-md bg-slate-200 text-slate-700 dark:bg-slate-750 dark:text-slate-300">
              <Laptop className="w-3.5 h-3.5" />
            </div>
            <div className="text-left rtl:text-right">
              <div className="text-xs font-bold">{t.themeSystem}</div>
              <div className="text-[10px] text-slate-400">OS preference</div>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Language & RTL Layout */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <Languages className="w-3.5 h-3.5 text-blue-500" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {t.languageSection}
            </h3>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {t.languageDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* English */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ language: 'en' })}
            className={`p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
              settings.language === 'en'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="text-xs font-bold">{t.langEnglish}</div>
              <div className="text-[10px] text-slate-400">Left-to-Right (LTR)</div>
            </div>
            {settings.language === 'en' && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>

          {/* Arabic */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ language: 'ar' })}
            className={`p-2.5 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
              settings.language === 'ar'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="text-xs font-bold">{t.langArabic}</div>
              <div className="text-[10px] text-slate-400">Right-to-Left (RTL) تخطيط كامل</div>
            </div>
            {settings.language === 'ar' && <Check className="w-3.5 h-3.5 text-blue-600" />}
          </button>
        </div>
      </div>

      {/* 3. Coordinate & Survey Defaults */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <Sliders className="w-3.5 h-3.5 text-emerald-500" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {t.coordSettingsSection}
            </h3>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {t.coordSettingsDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Default Conversion Direction */}
          <div className="space-y-0.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {t.defaultDirLabel}
            </label>
            <select
              value={settings.defaultDirection}
              onChange={(e) =>
                onUpdateSettings({ defaultDirection: e.target.value as 'WGS_TO_QND' | 'QND_TO_WGS' })
              }
              className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="WGS_TO_QND">WGS84 → QND95 (Qatar National Grid)</option>
              <option value="QND_TO_WGS">QND95 (Qatar National Grid) → WGS84</option>
            </select>
          </div>

          {/* Default WGS84 Input Format */}
          <div className="space-y-0.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {t.defaultWgsFormatLabel}
            </label>
            <select
              value={settings.defaultWgsFormat}
              onChange={(e) =>
                onUpdateSettings({ defaultWgsFormat: e.target.value as 'DD' | 'DMS' })
              }
              className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="DD">{t.formatDD}</option>
              <option value="DMS">{t.formatDMS}</option>
            </select>
          </div>

          {/* Projected Precision */}
          <div className="space-y-0.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {t.projPrecisionLabel}
            </label>
            <select
              value={settings.projectedPrecision}
              onChange={(e) => onUpdateSettings({ projectedPrecision: Number(e.target.value) })}
              className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value={2}>2 decimals (cm accuracy: 0.01m)</option>
              <option value={3}>3 decimals (1mm standard survey accuracy: 0.001m)</option>
              <option value={4}>4 decimals (sub-millimeter precision: 0.0001m)</option>
            </select>
          </div>

          {/* Geographic Precision */}
          <div className="space-y-0.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {t.geoPrecisionLabel}
            </label>
            <select
              value={settings.geographicPrecision}
              onChange={(e) => onUpdateSettings({ geographicPrecision: Number(e.target.value) })}
              className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value={5}>5 decimals (~1.1 meter)</option>
              <option value={6}>6 decimals (~0.11 meter / 11cm standard GPS)</option>
              <option value={7}>7 decimals (~1.1 cm geodetic precision)</option>
              <option value={8}>8 decimals (~1.1 mm scientific precision)</option>
            </select>
          </div>

          {/* Thousands Separator */}
          <div className="space-y-0.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {t.thousandsSepLabel}
            </label>
            <select
              value={settings.thousandsSeparator}
              onChange={(e) =>
                onUpdateSettings({ thousandsSeparator: e.target.value as ThousandsSeparator })
              }
              className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="comma">{t.sepComma}</option>
              <option value="space">{t.sepSpace}</option>
              <option value="none">{t.sepNone}</option>
            </select>
          </div>

          {/* Default Map Layer */}
          <div className="space-y-0.5">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {t.defaultMapLayerLabel}
            </label>
            <select
              value={settings.defaultMapLayer}
              onChange={(e) =>
                onUpdateSettings({ defaultMapLayer: e.target.value as MapLayerDefault })
              }
              className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="osm">{t.layerOsm}</option>
              <option value="satellite">{t.layerSatellite}</option>
            </select>
          </div>

          {/* Default Map Extent */}
          <div className="space-y-0.5 sm:col-span-2">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {t.defaultExtentLabel}
            </label>
            <select
              value={settings.defaultMapExtent}
              onChange={(e) =>
                onUpdateSettings({ defaultMapExtent: e.target.value as MapExtentDefault })
              }
              className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="qatar">{t.extentQatar}</option>
              <option value="doha">{t.extentDoha}</option>
              <option value="lusail">{t.extentLusail}</option>
              <option value="al-wakrah">{t.extentAlWakrah}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Manage Custom Saved Presets */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-purple-500" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {t.managePresets}
              </h3>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                Manage your custom survey reference marks and client project locations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddPresetModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3 h-3" />
            <span>{t.addPresetBtn}</span>
          </button>
        </div>

        {/* Custom Presets List */}
        {customPresets.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400 bg-slate-50 dark:bg-slate-850/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
            {t.noCustomPresets}
          </div>
        ) : (
          <div className="space-y-1.5">
            {customPresets.map((preset) => (
              <div
                key={preset.id}
                className="p-2 sm:p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{preset.name}</span>
                    {preset.nameAr && (
                      <span className="text-[10px] text-slate-400 font-normal">({preset.nameAr})</span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 font-medium">
                      {preset.category}
                    </span>
                  </div>
                  <div className="text-[10.5px] font-mono text-slate-500 dark:text-slate-400">
                    WGS84: {preset.lat.toFixed(5)}°, {preset.lng.toFixed(5)}° &bull; QND95: E{' '}
                    {Math.round(preset.easting).toLocaleString()}, N{' '}
                    {Math.round(preset.northing).toLocaleString()}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteCustomPreset(preset.id)}
                  title="Delete Custom Preset"
                  className="p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Data & Privacy */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {t.privacySection}
            </h3>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {t.privacyDesc}
            </p>
          </div>
        </div>

        {/* Privacy statement banner */}
        <div className="p-2.5 sm:p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed space-y-0.5">
          <div className="font-bold flex items-center gap-1.5">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>Strict Client-Side Guarantee</span>
          </div>
          <p className="text-[10.5px] opacity-90">{t.privacyStatement}</p>
        </div>

        {/* Action Buttons: Clear Data & Reset Settings */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>{t.clearAllDataBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t.resetSettingsBtn}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Clear Data */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {t.clearConfirmTitle}
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.clearConfirmDesc}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setShowClearConfirm(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Settings */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-blue-600">
              <RotateCcw className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                {t.resetConfirmTitle}
              </h4>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.resetConfirmDesc}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetSettings();
                  setShowResetConfirm(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Preset Modal */}
      {showAddPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSavePreset}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-purple-500" />
                <span>{t.addPresetBtn}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddPresetModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                {t.close}
              </button>
            </div>

            {presetFormError && (
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600 text-xs">
                {presetFormError}
              </div>
            )}

            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.presetName} *
                </label>
                <input
                  type="text"
                  required
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="e.g. Project Site Alpha"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.presetNameAr}
                </label>
                <input
                  type="text"
                  value={newPresetNameAr}
                  onChange={(e) => setNewPresetNameAr(e.target.value)}
                  placeholder="e.g. موقع المشروع ألفا"
                  dir="rtl"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.presetLat} (WGS84 DD) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newPresetLat}
                    onChange={(e) => setNewPresetLat(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.presetLng} (WGS84 DD) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newPresetLng}
                    onChange={(e) => setNewPresetLng(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t.presetDesc}
                </label>
                <input
                  type="text"
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="Optional surveyor remarks"
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddPresetModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

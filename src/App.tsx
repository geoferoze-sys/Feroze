/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar, AppTab } from './components/Navbar';
import { ConverterSection } from './components/ConverterSection';
import { MapSection } from './components/MapSection';
import { BatchSection } from './components/BatchSection';
import { SettingsSection } from './components/SettingsSection';
import {
  Compass,
  Map as MapIcon,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Globe,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS } from './types/settings';
import { QatarLocationPreset } from './types/coordinates';
import { getTranslation } from './utils/i18n';

export default function App() {
  // Navigation active tab: 'converter' | 'map' | 'batch' | 'settings'
  const [activeTab, setActiveTab] = useState<AppTab>('converter');

  // App Settings persisted in localStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('qnd95_app_settings');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      // Ignore fallback
    }
    return DEFAULT_SETTINGS;
  });

  // Custom User Presets persisted in localStorage
  const [customPresets, setCustomPresets] = useState<QatarLocationPreset[]>(() => {
    try {
      const saved = localStorage.getItem('qnd95_custom_presets');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Ignore fallback
    }
    return [];
  });

  // Target location passed from converter/batch to map
  const [mapTargetLocation, setMapTargetLocation] = useState<{
    lat: number;
    lng: number;
    label?: string;
  } | null>(null);

  // Target coordinates sent from map to converter
  const [converterInitialWgs, setConverterInitialWgs] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Synchronize Settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qnd95_app_settings', JSON.stringify(settings));
    } catch (e) {
      // ignore
    }
  }, [settings]);

  // Synchronize Custom Presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qnd95_custom_presets', JSON.stringify(customPresets));
    } catch (e) {
      // ignore
    }
  }, [customPresets]);

  // Synchronize Theme & System Theme Listener
  useEffect(() => {
    const updateThemeClass = () => {
      let isDark = false;
      if (settings.theme === 'dark') {
        isDark = true;
      } else if (settings.theme === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    updateThemeClass();

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => updateThemeClass();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings.theme]);

  // Synchronize Language and RTL layout on HTML root
  useEffect(() => {
    const isRtl = settings.language === 'ar';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const updateSettings = (newPartial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newPartial }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const clearAllData = () => {
    try {
      localStorage.removeItem('qnd95_app_settings');
      localStorage.removeItem('qnd95_custom_presets');
      localStorage.removeItem('qnd95_conversion_history');
      localStorage.removeItem('qnd95_dark_mode');
    } catch (e) {
      // ignore
    }
    setSettings(DEFAULT_SETTINGS);
    setCustomPresets([]);
  };

  const addCustomPreset = (preset: QatarLocationPreset) => {
    setCustomPresets((prev) => [preset, ...prev]);
  };

  const deleteCustomPreset = (id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  };

  // Switch to map from converter or batch
  const handleViewOnMap = (lat: number, lng: number, label?: string) => {
    setMapTargetLocation({ lat, lng, label });
    setActiveTab('map');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switch to converter from map
  const handleSendToConverter = (lat: number, lng: number) => {
    setConverterInitialWgs({ lat, lng });
    setActiveTab('converter');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const t = getTranslation(settings.language);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Header Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        language={settings.language}
        onToggleLanguage={() =>
          updateSettings({ language: settings.language === 'en' ? 'ar' : 'en' })
        }
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-3 pb-14 sm:pb-16">
        {/* Tab 1: Single Coordinate Converter */}
        {activeTab === 'converter' && (
          <ConverterSection
            onViewOnMap={handleViewOnMap}
            initialWgsCoords={converterInitialWgs}
          />
        )}

        {/* Tab 2: Geospatial Map (OSM & Satellite) */}
        {activeTab === 'map' && (
          <MapSection
            targetLocation={mapTargetLocation}
            onSendToConverter={handleSendToConverter}
          />
        )}

        {/* Tab 3: Batch Tools Workspace (CSV Import, Mapping, Conversion, Export) */}
        {activeTab === 'batch' && (
          <BatchSection
            settings={settings}
            language={settings.language}
            onViewOnMap={handleViewOnMap}
          />
        )}

        {/* Tab 4: Application Settings */}
        {activeTab === 'settings' && (
          <SettingsSection
            settings={settings}
            onUpdateSettings={updateSettings}
            onResetSettings={resetSettings}
            onClearAllData={clearAllData}
            customPresets={customPresets}
            onAddCustomPreset={addCustomPreset}
            onDeleteCustomPreset={deleteCustomPreset}
          />
        )}
      </main>

      {/* Global Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 py-1 px-2 sm:px-6 flex items-center justify-around sm:justify-center sm:gap-10 shadow-lg">
        {/* 1. Converter */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('converter');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 py-0.5 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'converter'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-102'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>{t.tabConverter}</span>
        </button>

        {/* 2. Map */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('map');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 py-0.5 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-102'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>{t.tabMap}</span>
        </button>

        {/* 3. Batch Tools */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('batch');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 py-0.5 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'batch'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-102'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{t.tabBatch}</span>
        </button>

        {/* 4. Settings */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('settings');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 py-0.5 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-102'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>{t.tabSettings}</span>
        </button>
      </nav>

      {/* Compact Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs py-3 px-3 sm:px-4 transition-colors">
        <div className="max-w-5xl mx-auto space-y-2.5">
          {/* Developer Note Card */}
          <div className="p-2.5 sm:p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200/60 dark:border-blue-900/40 text-slate-700 dark:text-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                  Hi there! I'm <strong className="text-blue-600 dark:text-blue-400 font-semibold">Feroze Khan</strong>, independent developer passionate about simple, useful Survey &amp; GIS tools.
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Questions, suggestions or feedback? Reach out directly at{' '}
                  <a
                    href="mailto:geoferoze@gmail.com"
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    geoferoze@gmail.com
                  </a>
                </p>
              </div>
              <a
                href="mailto:geoferoze@gmail.com"
                className="shrink-0 self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-2xs"
              >
                <Mail className="w-3 h-3" />
                <span>Contact Developer</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-1 text-center sm:text-left text-[11px]">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>
                QND95 / WGS84 Qatar Geodetic Converter &bull; EPSG:2932 / EPSG:4326
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>100% Client-Side In-Browser Calculation Guarantee</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

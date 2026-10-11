/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ConverterSection } from './components/ConverterSection';
import { MapSection } from './components/MapSection';
import { Compass, Map as MapIcon, Globe, Moon, Sun, Mail } from 'lucide-react';

export default function App() {
  // Navigation active tab: 'converter' | 'map'
  const [activeTab, setActiveTab] = useState<'converter' | 'map'>('converter');

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('qnd95_dark_mode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Target location passed from converter to map
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

  // Sync dark mode class on HTML document root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('qnd95_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Switch to map from converter
  const handleViewOnMap = (lat: number, lng: number, label?: string) => {
    setMapTargetLocation({ lat, lng, label });
    setActiveTab('map');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switch to converter from map
  const handleSendToConverter = (lat: number, lng: number) => {
    setConverterInitialWgs({ lat, lng });
    setActiveTab('converter');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Top Header Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-16">

        {/* Section 1: Bi-directional Coordinate Converter */}
        {activeTab === 'converter' && (
          <ConverterSection
            onViewOnMap={handleViewOnMap}
            initialWgsCoords={converterInitialWgs}
          />
        )}

        {/* Section 2: Geospatial Map (OSM & Satellite) */}
        {activeTab === 'map' && (
          <MapSection
            targetLocation={mapTargetLocation}
            onSendToConverter={handleSendToConverter}
          />
        )}
      </main>

      {/* Global Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 py-1.5 px-6 flex items-center justify-around sm:justify-center sm:gap-14 shadow-lg">
        <button
          type="button"
          onClick={() => {
            setActiveTab('converter');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-1 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'converter'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4 sm:w-4 sm:h-4" />
          <span>Converter</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('map');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-1 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'map'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-4 h-4 sm:w-4 sm:h-4" />
          <span>Map</span>
        </button>

        <button
          type="button"
          onClick={toggleDarkMode}
          className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-1 px-4 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
        >
          {isDarkMode ? (
            <>
              <Sun className="w-4 h-4 sm:w-4 sm:h-4 text-amber-400" />
              <span>Theme</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 sm:w-4 sm:h-4" />
              <span>Theme</span>
            </>
          )}
        </button>
      </nav>

      {/* Compact Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs py-3 px-3 sm:px-4 transition-colors">
        <div className="max-w-4xl mx-auto space-y-2.5">
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
            <p className="text-slate-400 dark:text-slate-500">
              Compliant with Qatar Center for GIS (CGIS) geodetic parameters
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

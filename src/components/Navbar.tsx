import React, { useState } from 'react';
import {
  Info,
  Layers,
  X,
  ExternalLink,
} from 'lucide-react';

import { AppLanguage } from '../types/settings';
import { getTranslation } from '../utils/i18n';

export type AppTab = 'converter' | 'map' | 'batch' | 'settings';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  language: AppLanguage;
  onToggleLanguage?: () => void;
}

/**
 * Custom Logo: Circular Surveyor Compass with Qatar Map and embedded Circular Compass Rose
 */
export const QatarCompassLogo: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Circle Compass with Qatar Map"
    >
      <defs>
        {/* Dial radial gradient */}
        <radialGradient id="qatarDialGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8A1538" />
          <stop offset="68%" stopColor="#5E0D25" />
          <stop offset="100%" stopColor="#360412" />
        </radialGradient>

        {/* Qatar Map fill gradient */}
        <linearGradient id="qatarMapGrad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="28%" stopColor="#F8FAFC" />
          <stop offset="38%" stopColor="#8A1538" />
          <stop offset="100%" stopColor="#670B24" />
        </linearGradient>

        {/* Gold metallic gradient for compass bezel */}
        <linearGradient id="goldRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="45%" stopColor="#D97706" />
          <stop offset="75%" stopColor="#CA8A04" />
          <stop offset="100%" stopColor="#FEF08A" />
        </linearGradient>

        {/* Subtle drop shadow */}
        <filter id="compassGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000000" floodOpacity="0.7" />
        </filter>
      </defs>

      {/* 1. Outer Circular Surveyor Compass Housing */}
      <circle cx="50" cy="50" r="47" fill="url(#qatarDialGrad)" stroke="url(#goldRimGrad)" strokeWidth="2.4" />
      <circle cx="50" cy="50" r="43.5" fill="none" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.4" />

      {/* 360-degree surveyor compass tick marks around circular perimeter */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <line
          key={deg}
          x1="50"
          y1="5"
          x2="50"
          y2={deg % 90 === 0 ? '9.5' : '7.5'}
          stroke={deg % 90 === 0 ? '#FDE047' : '#FFFFFF'}
          strokeWidth={deg % 90 === 0 ? '1.6' : '0.8'}
          strokeOpacity={deg % 90 === 0 ? '1' : '0.65'}
          transform={`rotate(${deg} 50 50)`}
        />
      ))}

      {/* 2. Qatar Peninsula Map Outline & Fill */}
      <path
        d="M 50 14 C 54 15 59 19 63 24 C 66 28 66 33 63 36 C 60 38 60 41 63 45 C 66 49 67 54 67 60 C 67 67 65 72 67 78 C 68 81 66 84 62 84 L 38 84 C 35 84 34 80 35 75 C 36 68 34 61 33 55 C 32 49 28 47 29 43 C 30 39 34 36 38 32 C 42 27 44 21 47 17 Z"
        fill="url(#qatarMapGrad)"
        stroke="#FDE047"
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="drop-shadow(0 2px 3px rgba(0,0,0,0.6))"
      />

      {/* Qatar Flag 9-Point Serration Accent across Peninsula */}
      <path
        d="M 45 22 L 48 25 L 45 28 L 48 31 L 45 34 L 48 37 L 45 40 L 48 43 L 45 46 L 48 49 L 45 52 L 48 55 L 45 58 L 48 61 L 45 64 L 48 67 L 45 70 L 48 73 L 45 76"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        fill="none"
        strokeOpacity="0.85"
      />

      {/* 3. Circular Compass Inside Qatar Map */}
      <g filter="url(#compassGlow)">
        {/* Outer Circular Compass Ring inside map */}
        <circle
          cx="50"
          cy="48"
          r="16.5"
          fill="#0F172A"
          fillOpacity="0.5"
          stroke="#FDE047"
          strokeWidth="1.3"
          strokeDasharray="2.5, 1.8"
        />

        {/* Inner Reticle Ring */}
        <circle
          cx="50"
          cy="48"
          r="11"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="0.8"
          strokeOpacity="0.85"
        />

        {/* Survey Coordinate Crosshairs */}
        <line
          x1="33"
          y1="48"
          x2="67"
          y2="48"
          stroke="#FDE047"
          strokeWidth="0.9"
          strokeDasharray="1.5, 1.5"
          strokeOpacity="0.95"
        />
        <line
          x1="50"
          y1="31"
          x2="50"
          y2="65"
          stroke="#FDE047"
          strokeWidth="0.9"
          strokeDasharray="1.5, 1.5"
          strokeOpacity="0.95"
        />

        {/* 4-Point Compass Star / Needle */}
        {/* North Pointer (Pointing straight North toward Ras Rakan) */}
        <polygon points="50,32 47.6,48 50,48" fill="#EF4444" />
        <polygon points="50,32 52.4,48 50,48" fill="#FDE047" />

        {/* South Pointer */}
        <polygon points="50,64 47.6,48 50,48" fill="#94A3B8" />
        <polygon points="50,64 52.4,48 50,48" fill="#CBD5E1" />

        {/* East Pointer */}
        <polygon points="66,48 50,46 50,48" fill="#FDE047" />
        <polygon points="66,48 50,50 50,48" fill="#CA8A04" />

        {/* West Pointer */}
        <polygon points="34,48 50,46 50,48" fill="#CBD5E1" />
        <polygon points="34,48 50,50 50,48" fill="#94A3B8" />

        {/* Cardinal 'N' Indicator */}
        <text
          x="50"
          y="28"
          fill="#FFFFFF"
          fontSize="5.5"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
          textAnchor="middle"
        >
          N
        </text>

        {/* Center Survey Jewel Pivot */}
        <circle cx="50" cy="48" r="2.8" fill="#FDE047" stroke="#1E293B" strokeWidth="1" />
        <circle cx="50" cy="48" r="1.1" fill="#FFFFFF" />
      </g>
    </svg>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  language,
  onToggleLanguage,
}) => {
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const t = getTranslation(language);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t-2 border-t-[#8A1538] border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-5xl mx-auto px-2.5 sm:px-4 min-h-11 py-1 flex items-center justify-between gap-2">
          {/* Brand & Title */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {/* Circle Compass inside Qatar Map Logo */}
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 via-[#8A1538] to-[#5A0B22] flex items-center justify-center shadow-xs shadow-[#8A1538]/25 shrink-0 transition-transform hover:scale-105">
              <QatarCompassLogo className="w-full h-full" />
            </div>

            {/* Title & Geodetic Reference */}
            <div className="flex flex-col justify-center min-w-0">
              <span className="font-black text-xs sm:text-sm tracking-wide text-slate-900 dark:text-white uppercase select-none leading-tight truncate">
                {t.appTitle}
              </span>

              {/* Subtitle / Geodetic Reference */}
              <div className="flex items-center">
                <span className="text-[9.5px] sm:text-[10.5px] font-medium text-slate-500 dark:text-slate-400 leading-tight line-clamp-1">
                  {t.appSubtitle}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop/Tablet Tab Navigation Pills */}
          <div className="hidden md:flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onSelectTab('converter')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'converter'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.tabConverter}
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('map')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.tabMap}
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('batch')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'batch'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.tabBatch}
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('settings')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {t.tabSettings}
            </button>
          </div>

          {/* Utility Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Language Toggle */}
            {onToggleLanguage && (
              <button
                type="button"
                onClick={onToggleLanguage}
                title="Switch Language / تغيير اللغة"
                className="px-2 py-0.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {language === 'en' ? 'عربي' : 'EN'}
              </button>
            )}

            {/* Info Button */}
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              title="Geodetic Specifications & Information"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Geodetic Information Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl max-w-lg w-full p-3.5 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                  <QatarCompassLogo className="w-full h-full" />
                </div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                  QND95 Geodetic Specifications
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>QND95 (Qatar National Datum 1995)</strong> is the official projected
                coordinate reference system for the State of Qatar, registered under{' '}
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                  EPSG:2932
                </span>
                .
              </p>

              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Projection:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Transverse Mercator (tmerc)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ellipsoid:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    International 1924 (Hayford)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Latitude of Origin:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    24° 27' 00" N (24.45°)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Central Meridian:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    51° 13' 00" E (51.216667°)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scale Factor:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    0.99999
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">False Easting:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    200,000.000 m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">False Northing:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    300,000.000 m
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                  Datum Transformation (7-Parameter Helmert):
                </h4>
                <p className="font-mono text-[11px] bg-slate-100 dark:bg-slate-850 p-2 rounded-lg text-slate-700 dark:text-slate-300">
                  dX: -119.4248m, dY: -303.6587m, dZ: -11.0006m, rX: 1.1643", rY: 0.1745", rZ: 1.0963", s: 3.6571 ppm
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                  Usage Instructions:
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400">
                  <li>Use the <strong>Converter</strong> tab to convert both directions with dedicated buttons.</li>
                  <li>In the <strong>Map</strong> tab, switch between OpenStreetMap and Satellite views.</li>
                  <li>In Satellite View, cursor coordinate tracking continuously computes live coordinates below the map.</li>
                  <li>Use the <strong>Dark Mode</strong> toggle in the top-right header for night surveying and field conditions.</li>
                </ul>
              </div>

              {/* Developer Note */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-1.5 text-[11px]">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>About the Developer</span>
                </h4>
                <p className="text-slate-600 dark:text-slate-300">
                  Hi there! I'm <strong>Feroze Khan</strong>, an independent developer passionate about building simple, useful tools in Survey &amp; GIS.
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Thank you for using Qatar Coordinate Converter. If you find it helpful, please consider leaving a review on the app store, or share your feedback directly at{' '}
                  <a
                    href="mailto:geoferoze@gmail.com"
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    geoferoze@gmail.com
                  </a>.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

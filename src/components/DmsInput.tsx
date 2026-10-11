import React from 'react';
import { DmsPart } from '../types/coordinates';

interface DmsInputProps {
  label: string;
  isLat: boolean;
  value: DmsPart;
  onChange: (value: DmsPart) => void;
}

export const DmsInput: React.FC<DmsInputProps> = ({
  label,
  isLat,
  value,
  onChange,
}) => {
  const handleDegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = raw === '' ? 0 : Math.min(isLat ? 90 : 180, Math.max(0, parseInt(raw, 10) || 0));
    onChange({ ...value, deg: num });
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = raw === '' ? 0 : Math.min(59, Math.max(0, parseInt(raw, 10) || 0));
    onChange({ ...value, min: num });
  };

  const handleSecChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = raw === '' ? 0 : Math.min(59.999, Math.max(0, parseFloat(raw) || 0));
    onChange({ ...value, sec: num });
  };

  const toggleDirection = () => {
    if (isLat) {
      onChange({ ...value, dir: value.dir === 'N' ? 'S' : 'N' });
    } else {
      onChange({ ...value, dir: value.dir === 'E' ? 'W' : 'E' });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
        <span>{label}</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
          {isLat ? '0° - 90°' : '0° - 180°'}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {/* Degrees */}
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={isLat ? 90 : 180}
            value={value.deg || ''}
            onChange={handleDegChange}
            placeholder="0"
            className="w-full h-9 pl-2 pr-4 text-xs sm:text-sm font-mono font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-center"
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
            °
          </span>
        </div>

        {/* Minutes */}
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={value.min || ''}
            onChange={handleMinChange}
            placeholder="0"
            className="w-full h-9 pl-2 pr-4 text-xs sm:text-sm font-mono font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-center"
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
            '
          </span>
        </div>

        {/* Seconds */}
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={59.99}
            value={value.sec || ''}
            onChange={handleSecChange}
            placeholder="0.00"
            className="w-full h-9 pl-1 pr-4 text-xs font-mono font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-center"
          />
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
            "
          </span>
        </div>

        {/* Direction Toggle Button */}
        <div>
          <button
            type="button"
            onClick={toggleDirection}
            title={`Toggle ${isLat ? 'North/South' : 'East/West'}`}
            className="w-full h-9 flex items-center justify-center text-xs sm:text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-blue-700 dark:text-blue-400 active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            {value.dir}
          </button>
        </div>
      </div>
    </div>
  );
};

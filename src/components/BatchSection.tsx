import React, { useState, useRef, useTransition } from 'react';
import {
  FileText,
  Upload,
  Clipboard,
  Play,
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowUpDown,
  Filter,
  Eye,
  MapPin,
  Search,
  Layers,
} from 'lucide-react';
import { wgs84ToQnd95, qnd95ToWgs84, isWithinQatarBounds, isWithinQatarGridBounds } from '../utils/coordinateConverter';
import { AppLanguage, AppSettings } from '../types/settings';
import { getTranslation } from '../utils/i18n';

interface BatchSectionProps {
  settings: AppSettings;
  language: AppLanguage;
  onViewOnMap?: (lat: number, lng: number, label?: string) => void;
}

export type BatchDirection = 'WGS_TO_QND' | 'QND_TO_WGS';

export interface RawParsedRow {
  rowIndex: number;
  raw: string[];
}

export interface ConvertedRecord {
  rowIndex: number;
  pointName: string;
  originalFirst: string;  // Lat (WGS) or Easting (QND)
  originalSecond: string; // Lng (WGS) or Northing (QND)
  // Results
  convertedFirst?: string;  // Easting (QND) or Lat (WGS)
  convertedSecond?: string; // Northing (QND) or Lng (WGS)
  // Raw numeric values for mapping
  rawLat?: number;
  rawLng?: number;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
  isOutsideQatar?: boolean;
}

// Sample WGS84 Dataset (Qatar Landmarks & Survey Hubs)
const SAMPLE_WGS84_CSV = `PointName,Latitude,Longitude
Doha_Corniche,25.285400,51.531000
Museum_Islamic_Art,25.295400,51.539200
Lusail_Marina,25.405200,51.527600
The_Pearl_Qatar,25.371200,51.551800
Hamad_Intl_Airport,25.273100,51.608100
Education_City,25.314200,51.441900
Al_Zubarah_Fort,25.976800,51.045700
Khor_Al_Adaid,24.646500,51.416200
Al_Wakrah_Port,25.176400,51.608900
Ras_Laffan_Industrial,25.908200,51.537200
Mesaieed_Port,24.991700,51.552400
Al_Khor_Park,25.688100,51.498300
Katara_Cultural_Village,25.358200,51.525500
Aspire_Zone_Stadium,25.263800,51.448500
Dukhan_Beach,25.429800,50.758200`;

// Sample QND95 Dataset (Qatar National Grid Projected Coordinates)
const SAMPLE_QND95_CSV = `PointName,Easting,Northing
Doha_Corniche,231735.610,392498.417
Museum_Islamic_Art,232558.814,393608.135
Lusail_Marina,231362.431,405768.715
The_Pearl_Qatar,233806.753,402008.141
Hamad_Intl_Airport,239504.707,391156.243
Education_City,222756.604,395670.770
Al_Zubarah_Fort,182958.403,469066.358
Khor_Al_Adaid,220277.185,321704.874
Al_Wakrah_Port,239572.190,380447.120
Ras_Laffan_Industrial,232296.840,461539.290`;

export const BatchSection: React.FC<BatchSectionProps> = ({
  settings,
  language,
  onViewOnMap,
}) => {
  const t = getTranslation(language);

  // Direction: WGS84 -> QND95 or QND95 -> WGS84
  const [direction, setDirection] = useState<BatchDirection>(settings.defaultDirection || 'WGS_TO_QND');

  // Input raw text
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parsing & Header Mapping State
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawParsedRow[]>([]);
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(true);

  // Column Mappings (indices)
  const [nameColIdx, setNameColIdx] = useState<number>(0);
  const [firstColIdx, setFirstColIdx] = useState<number>(1);  // Lat or Easting
  const [secondColIdx, setSecondColIdx] = useState<number>(2); // Lng or Northing

  // Precision controls
  const [projectedPrecision, setProjectedPrecision] = useState<number>(settings.projectedPrecision || 3);
  const [geographicPrecision, setGeographicPrecision] = useState<number>(settings.geographicPrecision || 6);

  // Conversion process & results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [conversionProgress, setConversionProgress] = useState<number>(0);
  const [convertedRecords, setConvertedRecords] = useState<ConvertedRecord[]>([]);
  const [resultsFilter, setResultsFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedAction, setCopiedAction] = useState<string | null>(null);

  // Parse lines into raw rows and detect headers
  const parseRawContent = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setHeaders([]);
      setRawRows([]);
      return;
    }

    // Determine delimiter (comma, tab, semicolon)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

    const parsed: string[][] = lines.map((line) => {
      // Basic CSV split supporting quoted strings
      const regex = new RegExp(`(?:${delimiter}|^)(?:"([^"]*)"|([^"${delimiter}]*))`, 'g');
      const row: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        let val = match[1] !== undefined ? match[1] : match[2];
        if (val === undefined) val = '';
        row.push(val.trim());
      }
      return row;
    });

    if (parsed.length === 0) return;

    // Check if first row looks like a header
    const firstRow = parsed[0];
    const isProbableHeader = firstRow.some((col) =>
      /^(name|point|pt|id|lat|lon|lng|east|north|x|y)/i.test(col.toLowerCase())
    );

    let extractedHeaders: string[] = [];
    let dataRows: RawParsedRow[] = [];

    if (isProbableHeader) {
      setHasHeaderRow(true);
      extractedHeaders = firstRow;
      dataRows = parsed.slice(1).map((r, idx) => ({ rowIndex: idx + 1, raw: r }));
    } else {
      setHasHeaderRow(false);
      extractedHeaders = firstRow.map((_, i) => `Column ${i + 1}`);
      dataRows = parsed.map((r, idx) => ({ rowIndex: idx + 1, raw: r }));
    }

    setHeaders(extractedHeaders);
    setRawRows(dataRows);

    // Auto map columns heuristically
    autoDetectColumns(extractedHeaders, direction);
  };

  const autoDetectColumns = (colHeaders: string[], activeDir: BatchDirection) => {
    let nameIdx = 0;
    let firstIdx = 1;
    let secondIdx = 2;

    colHeaders.forEach((header, idx) => {
      const h = header.toLowerCase();
      if (/name|id|point|pt|label|tag/i.test(h)) {
        nameIdx = idx;
      }
      if (activeDir === 'WGS_TO_QND') {
        if (/lat|latitude|y_coord|northing_deg/i.test(h)) firstIdx = idx;
        if (/lon|lng|longitude|x_coord|easting_deg/i.test(h)) secondIdx = idx;
      } else {
        if (/east|easting|x|e_m/i.test(h)) firstIdx = idx;
        if (/north|northing|y|n_m/i.test(h)) secondIdx = idx;
      }
    });

    setNameColIdx(nameIdx);
    setFirstColIdx(firstIdx < colHeaders.length ? firstIdx : (colHeaders.length > 1 ? 1 : 0));
    setSecondColIdx(secondIdx < colHeaders.length ? secondIdx : (colHeaders.length > 2 ? 2 : 0));
  };

  // Direct paste change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    setFileName('');
    parseRawContent(val);
  };

  // File upload handler
  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setRawText(content);
      parseRawContent(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Load sample dataset
  const handleLoadSample = (sampleType: BatchDirection) => {
    const sample = sampleType === 'WGS_TO_QND' ? SAMPLE_WGS84_CSV : SAMPLE_QND95_CSV;
    setDirection(sampleType);
    setRawText(sample);
    setFileName(sampleType === 'WGS_TO_QND' ? 'Sample_Qatar_WGS84.csv' : 'Sample_Qatar_QND95.csv');
    parseRawContent(sample);
  };

  // Switch direction
  const handleDirectionChange = (newDir: BatchDirection) => {
    setDirection(newDir);
    if (headers.length > 0) {
      autoDetectColumns(headers, newDir);
    }
  };

  // Execute Batch Conversion (Chunked for thousands of points)
  const runConversion = () => {
    if (rawRows.length === 0) return;

    setIsProcessing(true);
    setConversionProgress(0);
    setConvertedRecords([]);

    const total = rawRows.length;
    const chunkSize = 200; // process in batches of 200 to keep UI responsive
    let currentIndex = 0;
    const results: ConvertedRecord[] = [];

    const processNextChunk = () => {
      const limit = Math.min(currentIndex + chunkSize, total);

      for (let i = currentIndex; i < limit; i++) {
        const row = rawRows[i];
        const pointName = row.raw[nameColIdx]?.trim() || `Pt-${row.rowIndex}`;
        const rawFirst = row.raw[firstColIdx]?.trim() || '';
        const rawSecond = row.raw[secondColIdx]?.trim() || '';

        if (!rawFirst || !rawSecond) {
          results.push({
            rowIndex: row.rowIndex,
            pointName,
            originalFirst: rawFirst,
            originalSecond: rawSecond,
            status: 'ERROR',
            errorMessage: 'Missing coordinate value(s)',
          });
          continue;
        }

        const numFirst = parseFloat(rawFirst.replace(/,/g, ''));
        const numSecond = parseFloat(rawSecond.replace(/,/g, ''));

        if (isNaN(numFirst) || isNaN(numSecond)) {
          results.push({
            rowIndex: row.rowIndex,
            pointName,
            originalFirst: rawFirst,
            originalSecond: rawSecond,
            status: 'ERROR',
            errorMessage: 'Non-numeric coordinate value',
          });
          continue;
        }

        if (direction === 'WGS_TO_QND') {
          // Latitude: -90 to 90, Longitude: -180 to 180
          if (numFirst < -90 || numFirst > 90 || numSecond < -180 || numSecond > 180) {
            results.push({
              rowIndex: row.rowIndex,
              pointName,
              originalFirst: rawFirst,
              originalSecond: rawSecond,
              status: 'ERROR',
              errorMessage: 'Latitude (-90..90) or Longitude (-180..180) out of valid range',
            });
            continue;
          }

          try {
            const qnd = wgs84ToQnd95(numFirst, numSecond);
            const inQatar = isWithinQatarBounds(numFirst, numSecond);
            results.push({
              rowIndex: row.rowIndex,
              pointName,
              originalFirst: numFirst.toFixed(geographicPrecision),
              originalSecond: numSecond.toFixed(geographicPrecision),
              convertedFirst: qnd.easting.toFixed(projectedPrecision),
              convertedSecond: qnd.northing.toFixed(projectedPrecision),
              rawLat: numFirst,
              rawLng: numSecond,
              status: 'SUCCESS',
              isOutsideQatar: !inQatar,
            });
          } catch (err) {
            results.push({
              rowIndex: row.rowIndex,
              pointName,
              originalFirst: rawFirst,
              originalSecond: rawSecond,
              status: 'ERROR',
              errorMessage: 'Projection computation failed',
            });
          }
        } else {
          // QND95 -> WGS84
          try {
            const wgs = qnd95ToWgs84(numFirst, numSecond);
            const inGrid = isWithinQatarGridBounds(numFirst, numSecond);
            results.push({
              rowIndex: row.rowIndex,
              pointName,
              originalFirst: numFirst.toFixed(projectedPrecision),
              originalSecond: numSecond.toFixed(projectedPrecision),
              convertedFirst: wgs.dd.lat.toFixed(geographicPrecision),
              convertedSecond: wgs.dd.lng.toFixed(geographicPrecision),
              rawLat: wgs.dd.lat,
              rawLng: wgs.dd.lng,
              status: 'SUCCESS',
              isOutsideQatar: !inGrid,
            });
          } catch (err) {
            results.push({
              rowIndex: row.rowIndex,
              pointName,
              originalFirst: rawFirst,
              originalSecond: rawSecond,
              status: 'ERROR',
              errorMessage: 'Inverse projection computation failed',
            });
          }
        }
      }

      currentIndex = limit;
      setConversionProgress(Math.round((currentIndex / total) * 100));

      if (currentIndex < total) {
        setTimeout(processNextChunk, 0);
      } else {
        setConvertedRecords(results);
        setIsProcessing(false);
      }
    };

    setTimeout(processNextChunk, 0);
  };

  // Summary statistics
  const totalCount = convertedRecords.length;
  const successCount = convertedRecords.filter((r) => r.status === 'SUCCESS').length;
  const failedCount = convertedRecords.filter((r) => r.status === 'ERROR').length;

  // Filtered records for table view
  const displayRecords = convertedRecords
    .filter((r) => {
      if (resultsFilter === 'SUCCESS') return r.status === 'SUCCESS';
      if (resultsFilter === 'ERROR') return r.status === 'ERROR';
      return true;
    })
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.pointName.toLowerCase().includes(q) ||
        r.originalFirst.includes(q) ||
        r.originalSecond.includes(q) ||
        (r.convertedFirst && r.convertedFirst.includes(q)) ||
        (r.convertedSecond && r.convertedSecond.includes(q))
      );
    });

  // Export CSV
  const handleExportCSV = () => {
    if (convertedRecords.length === 0) return;

    let csvContent = '';
    if (direction === 'WGS_TO_QND') {
      csvContent = 'PointName,Latitude,Longitude,Easting,Northing,Status\r\n';
      convertedRecords.forEach((r) => {
        const pt = `"${r.pointName.replace(/"/g, '""')}"`;
        const lat = r.originalFirst;
        const lng = r.originalSecond;
        const east = r.convertedFirst || '';
        const north = r.convertedSecond || '';
        const status = r.status === 'SUCCESS' ? 'Success' : `Error: ${r.errorMessage}`;
        csvContent += `${pt},${lat},${lng},${east},${north},"${status}"\r\n`;
      });
    } else {
      csvContent = 'PointName,Easting,Northing,Latitude,Longitude,Status\r\n';
      convertedRecords.forEach((r) => {
        const pt = `"${r.pointName.replace(/"/g, '""')}"`;
        const east = r.originalFirst;
        const north = r.originalSecond;
        const lat = r.convertedFirst || '';
        const lng = r.convertedSecond || '';
        const status = r.status === 'SUCCESS' ? 'Success' : `Error: ${r.errorMessage}`;
        csvContent += `${pt},${east},${north},${lat},${lng},"${status}"\r\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'qatar_batch_converted';
    link.setAttribute('download', `${baseName}_converted.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy to clipboard (CSV or TSV)
  const handleCopyToClipboard = (format: 'tsv' | 'csv') => {
    if (convertedRecords.length === 0) return;

    const sep = format === 'tsv' ? '\t' : ',';
    let text = '';

    if (direction === 'WGS_TO_QND') {
      text = ['PointName', 'Latitude', 'Longitude', 'Easting', 'Northing', 'Status'].join(sep) + '\n';
      convertedRecords.forEach((r) => {
        text += [
          r.pointName,
          r.originalFirst,
          r.originalSecond,
          r.convertedFirst || '',
          r.convertedSecond || '',
          r.status === 'SUCCESS' ? 'Success' : `Error: ${r.errorMessage}`,
        ].join(sep) + '\n';
      });
    } else {
      text = ['PointName', 'Easting', 'Northing', 'Latitude', 'Longitude', 'Status'].join(sep) + '\n';
      convertedRecords.forEach((r) => {
        text += [
          r.pointName,
          r.originalFirst,
          r.originalSecond,
          r.convertedFirst || '',
          r.convertedSecond || '',
          r.status === 'SUCCESS' ? 'Success' : `Error: ${r.errorMessage}`,
        ].join(sep) + '\n';
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedAction(format);
    setTimeout(() => setCopiedAction(null), 2500);
  };

  return (
    <div className="space-y-2.5 pb-2">
      {/* Workspace Header & Privacy Guarantee */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2 sm:space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {t.batchTitle}
              </h2>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              {t.batchSubtitle}
            </p>
          </div>

          {/* Privacy Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold self-start sm:self-auto max-w-full shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="whitespace-normal break-words leading-tight">{t.privacyBadge}</span>
          </div>
        </div>

        {/* Quick Sample Loaders */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Quick Demos:
          </span>
          <button
            type="button"
            onClick={() => handleLoadSample('WGS_TO_QND')}
            className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[11px] font-medium cursor-pointer transition-colors"
          >
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>{t.loadSampleWgs}</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('QND_TO_WGS')}
            className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-[11px] font-medium cursor-pointer transition-colors"
          >
            <Sparkles className="w-3 h-3 text-emerald-500" />
            <span>{t.loadSampleQnd}</span>
          </button>
        </div>
      </div>

      {/* Step 1: Input & Direction Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            {t.step1Input}
          </h3>
          {rawText && (
            <button
              type="button"
              onClick={() => {
                setRawText('');
                setFileName('');
                setHeaders([]);
                setRawRows([]);
                setConvertedRecords([]);
              }}
              className="text-[11px] text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>{t.clearData}</span>
            </button>
          )}
        </div>

        {/* Direction Switcher Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleDirectionChange('WGS_TO_QND')}
            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
              direction === 'WGS_TO_QND'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/30 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="text-xs font-bold">{t.wgs84ToQnd95}</div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                Input: PointName, Lat, Lng → Output: Easting, Northing
              </div>
            </div>
            {direction === 'WGS_TO_QND' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => handleDirectionChange('QND_TO_WGS')}
            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
              direction === 'QND_TO_WGS'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="text-xs font-bold">{t.qnd95ToWgs84}</div>
              <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
                Input: PointName, Easting, Northing → Output: Lat, Lng
              </div>
            </div>
            {direction === 'QND_TO_WGS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          </button>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-3 sm:p-3.5 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 scale-[0.99]'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-850/50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            accept=".csv,.txt,.tsv"
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Upload className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {fileName ? `Loaded: ${fileName}` : t.dragDropText}
            </p>
            <p className="text-[10px] text-slate-400">
              Accepts .CSV, .TSV, or plain text with comma, tab, or semicolon delimiters
            </p>
          </div>
        </div>

        {/* Direct Text Paste Area */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>{t.pasteTabular}</span>
            {rawRows.length > 0 && (
              <span className="text-[10.5px] font-normal text-blue-600 dark:text-blue-400">
                {rawRows.length} rows loaded
              </span>
            )}
          </label>
          <textarea
            value={rawText}
            onChange={handleTextChange}
            placeholder={t.pastePlaceholder}
            rows={3.5}
            className="w-full rounded-lg p-2 sm:p-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400 resize-y"
          />
        </div>
      </div>

      {/* Step 2: Column Mapping & Preview */}
      {headers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2.5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {t.step2Mapping}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.parsedSummary.replace('{count}', String(rawRows.length))}
              </p>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={hasHeaderRow}
                onChange={(e) => setHasHeaderRow(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{t.hasHeaderRow}</span>
            </label>
          </div>

          {/* Interactive Column Mapper Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Field 1: Point Name */}
            <div className="space-y-0.5">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {t.mapPointName}
              </label>
              <select
                value={nameColIdx}
                onChange={(e) => setNameColIdx(Number(e.target.value))}
                className="w-full h-8 px-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500"
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    Column {i + 1}: {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Field 2: Latitude / Easting */}
            <div className="space-y-0.5">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {direction === 'WGS_TO_QND' ? 'Latitude Column (Y)' : 'Easting Column (X)'}
              </label>
              <select
                value={firstColIdx}
                onChange={(e) => setFirstColIdx(Number(e.target.value))}
                className="w-full h-8 px-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500"
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    Column {i + 1}: {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Field 3: Longitude / Northing */}
            <div className="space-y-0.5">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {direction === 'WGS_TO_QND' ? 'Longitude Column (X)' : 'Northing Column (Y)'}
              </label>
              <select
                value={secondColIdx}
                onChange={(e) => setSecondColIdx(Number(e.target.value))}
                className="w-full h-8 px-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500"
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    Column {i + 1}: {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* First Rows Preview Table */}
          <div className="space-y-1">
            <div className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
              Input Preview (First 5 Rows):
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-1.5 px-2.5">#</th>
                    <th className="py-1.5 px-2.5">
                      Point Name <span className="text-blue-500 font-normal">({headers[nameColIdx]})</span>
                    </th>
                    <th className="py-1.5 px-2.5">
                      {direction === 'WGS_TO_QND' ? 'Latitude' : 'Easting'}{' '}
                      <span className="text-blue-500 font-normal">({headers[firstColIdx]})</span>
                    </th>
                    <th className="py-1.5 px-2.5">
                      {direction === 'WGS_TO_QND' ? 'Longitude' : 'Northing'}{' '}
                      <span className="text-blue-500 font-normal">({headers[secondColIdx]})</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {rawRows.slice(0, 5).map((row) => (
                    <tr key={row.rowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                      <td className="py-1 px-2.5 text-slate-400">{row.rowIndex}</td>
                      <td className="py-1 px-2.5 font-semibold text-slate-800 dark:text-slate-200">
                        {row.raw[nameColIdx] || `Pt-${row.rowIndex}`}
                      </td>
                      <td className="py-1 px-2.5 text-blue-600 dark:text-blue-400">
                        {row.raw[firstColIdx] || '—'}
                      </td>
                      <td className="py-1 px-2.5 text-blue-600 dark:text-blue-400">
                        {row.raw[secondColIdx] || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Configurable Precision & Convert Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Precision Options */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-[11px]">QND95 Decimals:</span>
                <select
                  value={projectedPrecision}
                  onChange={(e) => setProjectedPrecision(Number(e.target.value))}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  <option value={2}>2 (cm)</option>
                  <option value={3}>3 (1mm standard)</option>
                  <option value={4}>4 (0.1mm high-res)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-[11px]">WGS84 Decimals:</span>
                <select
                  value={geographicPrecision}
                  onChange={(e) => setGeographicPrecision(Number(e.target.value))}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                >
                  <option value={5}>5 (~1m)</option>
                  <option value={6}>6 (~0.1m standard)</option>
                  <option value={7}>7 (~1cm)</option>
                  <option value={8}>8 (~1mm)</option>
                </select>
              </div>
            </div>

            {/* Run Button */}
            <button
              type="button"
              onClick={runConversion}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isProcessing ? 'animate-spin' : ''}`} />
              <span>
                {isProcessing
                  ? `${t.converting} (${conversionProgress}%)`
                  : `${t.convertBtn} (${rawRows.length} Points)`}
              </span>
            </button>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-1">
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-150"
                  style={{ width: `${conversionProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Converted Results & Export Workspace */}
      {convertedRecords.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 shadow-2xs border border-slate-200 dark:border-slate-800 space-y-2.5 animate-in fade-in">
          {/* Summary Stat Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>{t.resultsHeader}</span>
                <span className="text-[10px] font-normal text-slate-400">
                  ({t.preserveNotice})
                </span>
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.downloadCsv}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyToClipboard('tsv')}
                title="Copy TSV formatted text to paste directly into Excel or Sheets"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedAction === 'tsv' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t.copyTsv}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-center">
              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{totalCount}</div>
              <div className="text-[10.5px] font-medium text-slate-500">{t.totalRecords}</div>
            </div>

            <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-center">
              <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">{successCount}</div>
              <div className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300">{t.successRecords}</div>
            </div>

            <div className="p-2 sm:p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-center">
              <div className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400">{failedCount}</div>
              <div className="text-[10.5px] font-semibold text-rose-700 dark:text-rose-300">{t.failedRecords}</div>
            </div>
          </div>

          {/* Filtering and search toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setResultsFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                  resultsFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.filterAll} ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setResultsFilter('SUCCESS')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                  resultsFilter === 'SUCCESS'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.filterSuccess} ({successCount})
              </button>
              <button
                type="button"
                onClick={() => setResultsFilter('ERROR')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                  resultsFilter === 'ERROR'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.filterFailed} ({failedCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchRecords}
                className="pl-8 pr-3 py-1 rounded-lg text-xs bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 w-full sm:w-56 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Results Table (Responsive scrollable) */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 z-10">
                <tr>
                  <th className="py-2 px-2.5">#</th>
                  <th className="py-2 px-2.5">{t.tablePoint}</th>
                  {direction === 'WGS_TO_QND' ? (
                    <>
                      <th className="py-2 px-2.5">Latitude (WGS)</th>
                      <th className="py-2 px-2.5">Longitude (WGS)</th>
                      <th className="py-2 px-2.5 text-emerald-600 dark:text-emerald-400">Easting (QND95)</th>
                      <th className="py-2 px-2.5 text-emerald-600 dark:text-emerald-400">Northing (QND95)</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2 px-2.5">Easting (QND95)</th>
                      <th className="py-2 px-2.5">Northing (QND95)</th>
                      <th className="py-2 px-2.5 text-blue-600 dark:text-blue-400">Latitude (WGS)</th>
                      <th className="py-2 px-2.5 text-blue-600 dark:text-blue-400">Longitude (WGS)</th>
                    </>
                  )}
                  <th className="py-2 px-2.5">{t.tableStatus}</th>
                  <th className="py-2 px-2.5 text-right">{t.tableActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {displayRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-5 text-center text-slate-400">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  displayRecords.map((r) => (
                    <tr
                      key={r.rowIndex}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-850/60 ${
                        r.status === 'ERROR' ? 'bg-rose-50/30 dark:bg-rose-950/15' : ''
                      }`}
                    >
                      <td className="py-1.5 px-2.5 text-slate-400">{r.rowIndex}</td>
                      <td className="py-1.5 px-2.5 font-sans font-bold text-slate-900 dark:text-slate-100">
                        {r.pointName}
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-300">{r.originalFirst}</td>
                      <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-300">{r.originalSecond}</td>
                      <td className="py-1.5 px-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        {r.convertedFirst || '—'}
                      </td>
                      <td className="py-1.5 px-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        {r.convertedSecond || '—'}
                      </td>
                      <td className="py-1.5 px-2.5">
                        {r.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            <Check className="w-2.5 h-2.5" />
                            <span>{t.rowSuccess}</span>
                          </span>
                        ) : (
                          <span
                            title={r.errorMessage}
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span className="line-clamp-1">{r.errorMessage || t.rowError}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-right">
                        {r.status === 'SUCCESS' && r.rawLat && r.rawLng && onViewOnMap && (
                          <button
                            type="button"
                            onClick={() => onViewOnMap(r.rawLat!, r.rawLng!, r.pointName)}
                            title="Inspect on Interactive Map"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[10px] font-semibold cursor-pointer transition-colors"
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            <span>Map</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

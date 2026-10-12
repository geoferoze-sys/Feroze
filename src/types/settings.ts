export type ThemePreference = 'light' | 'dark' | 'system';
export type AppLanguage = 'en' | 'ar';
export type ThousandsSeparator = 'comma' | 'space' | 'none';
export type MapLayerDefault = 'osm' | 'satellite';
export type MapExtentDefault = 'qatar' | 'doha' | 'lusail' | 'al-wakrah';

export interface AppSettings {
  theme: ThemePreference;
  language: AppLanguage;
  defaultDirection: 'WGS_TO_QND' | 'QND_TO_WGS';
  defaultWgsFormat: 'DD' | 'DMS';
  projectedPrecision: number; // e.g. 3
  geographicPrecision: number; // e.g. 6
  thousandsSeparator: ThousandsSeparator;
  defaultMapLayer: MapLayerDefault;
  defaultMapExtent: MapExtentDefault;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
  defaultDirection: 'WGS_TO_QND',
  defaultWgsFormat: 'DD',
  projectedPrecision: 3,
  geographicPrecision: 6,
  thousandsSeparator: 'comma',
  defaultMapLayer: 'osm',
  defaultMapExtent: 'qatar',
};

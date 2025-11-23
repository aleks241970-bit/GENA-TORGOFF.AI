
export enum AppMode {
  GENERATE = 'GENERATE',
  STYLIZE = 'STYLIZE',
  CLEANUP = 'CLEANUP',
  MIX = 'MIX',
  PARTIAL_STYLE = 'PARTIAL_STYLE',
  REMOVE_BG = 'REMOVE_BG',
  RESTORATION = 'RESTORATION',
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export interface GeminiError {
  message: string;
}

export type StylePreset = {
  id: string;
  name: string;
  promptSuffix: string;
};
// src/lib/types/index.ts

// Structure of the successful API response
export interface FindApiResponse {
  thoughts: string[];
}

// TO-DO: error structure from API
export interface ApiError {
  message: string;
  details?: unknown;
}

export type IdentifierValues = { [key: string]: string };

// Represents the structure of arbitrary JSON-like config (like a Struct converted)
export type ConfigsType = { [key: string]: any };

// The combined configs returned by the GetConfigs RPC
export interface AllConfigsType {
  sources: ConfigsType;
  tasks: ConfigsType;
}

export interface ReviewDiscardApiResponse {
  message: string
  id: number
}

export interface ReviewCardResponse {
  thought_id: number;
  text: string;
}

export interface ReviewGradeSubmission {
  grade: number;
}

// --- Add Data ---

export interface AddDataRequest {
  task: string;
  sourceType: string;
  sourceIdentifiers: { [key: string]: string };
  fileContent?: Uint8Array | undefined;
  textList: string[];
}

export interface AddDataResponse {
  success: boolean;
  message: string;
}

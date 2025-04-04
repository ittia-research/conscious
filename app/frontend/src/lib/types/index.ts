// Structure of the successful API response
export interface FindApiResponse {
  thoughts: string[];
}

export interface ConfigsApiResponse {
  configs: { [key: string]: any };
}

// TO-DO: error structure from API
export interface ApiError {
  message: string;
  details?: unknown;
}

export type IdentifierValues = { [key: string]: string };
 
// Structure of the successful API response
export interface FindApiResponse {
  thoughts: string[];
}

// TO-DO: error structure from API
export interface ApiError {
  message: string;
  details?: unknown;
}

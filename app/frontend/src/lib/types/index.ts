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
import { env } from '$env/dynamic/private';
import type { ConfigsApiResponse, FindApiResponse, 
    ApiError, IdentifierValues, ReviewDiscardApiResponse,
    ReviewCardResponse, ReviewGradeSubmission
 } from '$lib/types';

// --- Helper for making authenticated requests ---
interface RequestOptions extends Omit<RequestInit, 'body'> {
	body?: object; // Allow passing objects directly
	endpoint: string; // Relative endpoint path (e.g., '/find')
}

async function makeApiRequest<T>(options: RequestOptions): Promise<T> {
    const API_BASE = env.BACKEND_API_BASE;
    const API_KEY = env.BACKEND_API_KEY;

    if (!API_BASE || !API_KEY) {
        // Log the error server-side for debugging
        console.error('FATAL: Backend API Base URL or API Key is not configured in the server environment.');
        throw new Error('Server configuration error: Missing backend API credentials.');
    }

	const { endpoint, body, method = 'GET', headers = {}, ...restOptions } = options;
	const url = `${API_BASE}${endpoint}`;

	const defaultHeaders: HeadersInit = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${API_KEY}`,
		...headers
	};

	try {
		const jsonString = JSON.stringify(body);

		const response = await fetch(url, {
			method: method,
			headers: defaultHeaders,
			body: body ? JSON.stringify(body) : undefined,
			...restOptions
		});

		if (!response.ok) {
			let errorData: ApiError = { message: `API Error: ${response.status} ${response.statusText}` };
			try {
				// Try to parse a more specific error from the API response body
				const parsedError = await response.json();
				if (parsedError && typeof parsedError.message === 'string') {
					errorData = parsedError as ApiError;
				}
			} catch (parseError) {
				// Ignore if response body isn't valid JSON or doesn't match ApiError shape
			}
			console.error(`API Request Failed: ${method} ${url}`, errorData);
			throw { status: response.status, ...errorData };
		}

        // Handle cases with no content expected
        if (response.status === 204) {
            return undefined as T;
        }

		// Assuming successful responses return JSON
		return (await response.json()) as T;

	} catch (error: any) {
        // Re-throw structured errors from the fetch block, wrap others
        if (error.status) {
            throw error; // Already a structured API error
        } else {
            console.error(`Network or other error calling API: ${method} ${url}`, error);
            throw { status: 500, message: 'Failed to connect to the API service.', details: error.message } as ApiError;
        }
	}
}

// Get thoughts from backend
export async function findThoughts(text: string, type: string, identifiers: IdentifierValues): Promise<string[]> {
	try {
		const response = await makeApiRequest<FindApiResponse>({
			endpoint: '/v1/find',
			method: 'POST',
			body: { text, type, identifiers }
		});
		return response.thoughts || [];
	} catch (error) {
		console.error('Error in findThoughts:', error);
		throw error;
	}
}


// == Get configs of sources with caching ==
export interface ConfigsType {
    [key: string]: any;
}

let cachedConfigs: ConfigsType | null = null;
let fetchPromise: Promise<ConfigsType> | null = null;

/**
 * Ensures the fetch happens only once per server instance lifetime.
 * Handles concurrent requests gracefully.
 */
export async function getConfigsSources(): Promise<ConfigsType> {
    // Return cached data if available
    if (cachedConfigs !== null) {
        return cachedConfigs;
    }

    // Return existing promise if fetch is in progress
    if (fetchPromise !== null) {
        return fetchPromise;
    }

    // Initiate the fetch
    console.log('Initiating config fetch via server API client...');
    fetchPromise = (async (): Promise<ConfigsType> => {
        try {
            const response = await makeApiRequest<ConfigsApiResponse>({
                endpoint: '/v1/configs/sources',
                method: 'GET',
            });

            const configs = response.configs || {};
            cachedConfigs = configs; // Cache the result on success
            console.log('Configs fetched and cached successfully.');
            return configs;
        } catch (error) {
            console.error('Error in getConfigSourcesFromServer:', error);
            fetchPromise = null; // Reset promise on error to allow retries on subsequent requests
            throw error; // Re-throw so the caller (load function) knows about the failure
        }
    })();

    return fetchPromise;
}


// -- Discard a card --
export async function discardCard(thoughtId: number): Promise<any> {
    try {
		const response = await makeApiRequest<ReviewDiscardApiResponse>({
			endpoint: `/v1/review/${thoughtId}/discard`,
			method: 'POST'
		});
        return response;
    } catch (error) {
        console.error("Error discarding card:", error);
        throw error;
    }
}


// -- Get next card --
export async function getNextReviewCard(): Promise<ReviewCardResponse | null> {
    try {
		const response = await makeApiRequest<ReviewCardResponse>({
			endpoint: `/v1/review/next`,
			method: 'GET'
		});

        console.log(response)
        // TO-DO: handle of different errors
        return response as ReviewCardResponse | null;
    } catch (error) {
        console.error("Error fetching next card:", error);
        throw error;
    }
}


// -- Card review --
export async function submitReviewGrade(thoughtId: number, grade: number): Promise<any> {
    const submission: ReviewGradeSubmission = { grade };
    try {
		const response = await makeApiRequest<any>({
			endpoint: `/v1/review/${thoughtId}/submit`,
			method: 'POST',
			body: submission
		});
        return response;
    } catch (error) {
        console.error("Error submitting grade:", error);
        throw error;
    }
}
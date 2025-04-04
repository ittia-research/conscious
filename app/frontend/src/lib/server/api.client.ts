import { env } from '$env/dynamic/private';
import type { ConfigsApiResponse, FindApiResponse, ApiError, IdentifierValues } from '$lib/types';

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
 
// Get configs of sources
export async function getConfigsSources() {
	try {
		const response = await makeApiRequest<ConfigsApiResponse>({
			endpoint: '/v1/configs/sources',
			method: 'GET'
		});
		return response.configs || {};
	} catch (error) {
		console.error('Error in findThoughts:', error);
		throw error;
	}
}

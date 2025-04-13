// src/lib/server/reviewSession.ts
import type { ReviewCardResponse } from '$lib/types';
// Assume apiClient functions might throw errors with a 'status' property
import { getNextReviewCards, submitReviewGrade, discardCard } from './apiClient';

// --- Result Type Definition ---
// Define specific success data structure if known, otherwise use a generic approach
// Example: interface ReviewSuccessData { nextCard?: ReviewCardResponse; /* other fields */ }
type ReviewSuccessData = Record<string, any>; // Or define a more specific interface

interface ReviewActionResultSuccess {
	success: true;
	message?: string; // Optional success message
	status?: number; // Typically 200 or 201 for success
	data?: ReviewSuccessData; // Optional data payload for the client
}

interface ReviewActionResultError {
	success: false;
	message: string; // Error message for the user
	status: number; // HTTP status code reflecting the error type
}

// Union type for easier handling
export type ReviewActionResult = ReviewActionResultSuccess | ReviewActionResultError;


// --- Business Logic Functions ---

/**
 * Handles the submission of a review grade.
 * @param thoughtId The ID of the card being graded.
 * @param grade The grade assigned (1-4).
 * @param fetchFn The fetch function passed from SvelteKit.
 * @returns A ReviewActionResult indicating success or failure.
 */
export async function handleGradeSubmission(thoughtId: number, grade: number, fetchFn: typeof fetch): Promise<ReviewActionResult> {
	try {
		// Assuming submitReviewGrade might return data or throw specific errors
		const resultData = await submitReviewGrade(thoughtId, grade, fetchFn);

		// In production, replace console.log with a structured logger
		console.log(`[ReviewSession] Successfully submitted grade for thought ${thoughtId}`);

		return {
		    success: true,
		    status: 200, // OK
		    message: 'Grade submitted successfully.',
		    // Include any relevant data returned by the API client if needed
		    // data: { someData: resultData }
		};

	} catch (error: any) {
        // In production, replace console.error with a structured logger, including error details
		console.error(`[ReviewSession] Error submitting grade for thought ${thoughtId}:`, error);

        // Determine appropriate status code. Use error.status if available (e.g., from fetch response), otherwise default.
        const statusCode = typeof error?.status === 'number' ? error.status : 500; // Default to Internal Server Error

        // Provide a user-friendly message, potentially using error.message if safe/intended for users
		const errorMessage = error?.message && typeof error.message === 'string' && statusCode < 500
            ? error.message // Use error message for client errors (4xx) if available
            : 'Failed to process grade due to a server error.'; // Generic message for server errors (5xx) or unknown

		return {
		    success: false,
		    message: errorMessage,
		    status: statusCode
		};
	}
}

/**
 * Handles discarding a review card.
 * @param thoughtId The ID of the card to discard.
 * @param fetchFn The fetch function passed from SvelteKit.
 * @returns A ReviewActionResult indicating success or failure.
 */
export async function handleDiscard(thoughtId: number, fetchFn: typeof fetch): Promise<ReviewActionResult> {
	try {
		await discardCard(thoughtId, fetchFn);

        // In production, replace console.log with a structured logger
        console.log(`[ReviewSession] Successfully discarded thought ${thoughtId}`);

		return {
		    success: true,
		    status: 200, // OK
		    message: 'Card discarded successfully.'
		    // data: { ... } // Include data if the API returns something useful
		};
	} catch (error: any) {
        // In production, replace console.error with a structured logger
		console.error(`[ReviewSession] Error discarding thought ${thoughtId}:`, error);

        const statusCode = typeof error?.status === 'number' ? error.status : 500;
		const errorMessage = error?.message && typeof error.message === 'string' && statusCode < 500
            ? error.message
            : 'Failed to discard card due to a server error.';

		return {
		    success: false,
		    message: errorMessage,
		    status: statusCode
        };
	}
}

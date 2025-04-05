// src/lib/server/reviewSession.ts
import type { ReviewCardResponse } from '$lib/types';
import { getNextReviewCard, submitReviewGrade, discardCard } from './apiClient';

// Define consistent return types for session actions
interface ReviewActionResultSuccess {
    success: true;
    nextCard: ReviewCardResponse | null; // The card to show next
}

interface ReviewActionResultError {
    success: false;
    message: string; // Error message for the user
}

export type ReviewActionResult = ReviewActionResultSuccess | ReviewActionResultError;

interface InitialDataResult {
     initialCard: ReviewCardResponse | null;
     loadError?: string;
}


/**
 * Handles the logic for submitting a grade and fetching the next card.
 * Encapsulates the success/error handling for route actions.
 */
export async function handleGradeSubmission(thoughtId: number, grade: number, fetchFn: typeof fetch): Promise<ReviewActionResult> {
    try {
        // Step 1: Submit the grade
        await submitReviewGrade(thoughtId, grade, fetchFn);

        // Step 2: Fetch the next card
        const nextCard = await getNextReviewCard(fetchFn);

        return { success: true, nextCard: nextCard };
    } catch (error: any) {
        console.error(`ReviewSession Error (handleGradeSubmission for ${thoughtId}):`, error);
        return { success: false, message: error.message || 'Failed to process grade.' };
    }
}

/**
 * Handles the logic for discarding a card and fetching the next card.
 */
export async function handleDiscard(thoughtId: number, fetchFn: typeof fetch): Promise<ReviewActionResult> {
    try {
        await discardCard(thoughtId, fetchFn);
        const nextCard = await getNextReviewCard(fetchFn);
        return { success: true, nextCard: nextCard };
    } catch (error: any) {
        console.error(`ReviewSession Error (handleDiscard for ${thoughtId}):`, error);
        return { success: false, message: error.message || 'Failed to discard card.' };
    }
}

/**
 * Handles explicitly fetching the next card.
 */
export async function handleGetNext(fetchFn: typeof fetch): Promise<ReviewActionResult> {
     try {
        const nextCard = await getNextReviewCard(fetchFn);
        return { success: true, nextCard: nextCard };
    } catch (error: any) {
        console.error(`ReviewSession Error (handleGetNext):`, error);
        return { success: false, message: error.message || 'Failed to fetch next card.' };
    }
}

/**
 * Gets the initial data needed for the review page load.
 */
export async function getInitialReviewData(fetchFn: typeof fetch): Promise<InitialDataResult> {
     try {
        const initialCard = await getNextReviewCard(fetchFn);
        return { initialCard: initialCard };
    } catch (error: any) {
        console.error("ReviewSession Error (getInitialReviewData):", error);
        return {
            initialCard: null,
            loadError: error.message || 'Could not load review session.'
        };
    }
}
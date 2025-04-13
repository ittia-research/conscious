// src/routes/review/+page.server.ts
import { fail } from '@sveltejs/kit';
import {
    handleGradeSubmission,
    handleDiscard,
} from '$lib/server/reviewSession'; // Import the refined handlers
import type { Actions } from './$types';
// Consider using a validation library like Zod for more complex forms
// import { z } from 'zod';

// --- Server Actions ---
export const actions: Actions = {
    /**
     * Action to submit a grade for a review card.
     */
    submitGrade: async ({ request, fetch }) => {
        // In production, consider using a structured logger instead of console.log/error
        console.log('[Action submitGrade] Received request.');

        const formData = await request.formData();
        const thoughtIdStr = formData.get('thoughtId')?.toString();
        const gradeStr = formData.get('grade')?.toString();

        // --- Input Validation ---
        // Basic validation remains here as it validates the incoming request data.
        // For more complex validation, use a schema library (e.g., Zod) here.
        const thoughtId = parseInt(thoughtIdStr ?? '', 10);
        const grade = parseInt(gradeStr ?? '', 10);

        if (isNaN(thoughtId) || isNaN(grade) || grade < 1 || grade > 4) {
            const errorMessage = `Invalid input: thoughtId='${thoughtIdStr}', grade='${gradeStr}'. Grade must be between 1 and 4.`;
            console.error(`[Action submitGrade] Validation failed: ${errorMessage}`);
            // Return 400 Bad Request for invalid user input
            return fail(400, { message: errorMessage, incorrectGrade: gradeStr, incorrectThoughtId: thoughtIdStr });
        }
        // --- End Input Validation ---

        console.log(`[Action submitGrade] Processing ID: ${thoughtId}, Grade: ${grade}`);
        const result = await handleGradeSubmission(thoughtId, grade, fetch);

        if (!result.success) {
            console.error(`[Action submitGrade] Handler failed for ID ${thoughtId}: Status=${result.status}, Message='${result.message}'`);
            // Use the status code from the result, default to 500 if somehow missing
            // Pass the specific error message back to the client via fail()
            return fail(result.status ?? 500, { message: result.message });
        }

        // On success, return the full result object from the handler.
        // This allows passing data (like a success message or next item) back to the client.
        console.log(`[Action submitGrade] Success for ID: ${thoughtId}. Returning result:`, result);
        return result; // Return the entire success object (which now includes status, message, optional data)
    },

    /**
     * Action to discard a review card.
     */
    discardCard: async ({ request, fetch }) => {
        // In production, consider using a structured logger
        console.log('[Action discardCard] Received request.');

        const formData = await request.formData();
        const thoughtIdStr = formData.get('thoughtId')?.toString();

        // --- Input Validation ---
        const thoughtId = parseInt(thoughtIdStr ?? '', 10);

        if (isNaN(thoughtId)) {
            const errorMessage = `Invalid input: thoughtId='${thoughtIdStr}'.`;
            console.error(`[Action discardCard] Validation failed: ${errorMessage}`);
            return fail(400, { message: errorMessage, incorrectThoughtId: thoughtIdStr });
        }
        // --- End Input Validation ---

        console.log(`[Action discardCard] Processing ID: ${thoughtId}`);
        const result = await handleDiscard(thoughtId, fetch); // Call the handler

        if (!result.success) {
             console.error(`[Action discardCard] Handler failed for ID ${thoughtId}: Status=${result.status}, Message='${result.message}'`);
             // Use status from result, default to 500
             return fail(result.status ?? 500, { message: result.message });
        }

        console.log(`[Action discardCard] Success for ID: ${thoughtId}. Returning result:`, result);
        return result; // Return the entire success object
    }
};


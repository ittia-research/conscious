// src/routes/review/+page.server.ts
import { fail } from '@sveltejs/kit';
import {
    getInitialReviewData,
    handleGradeSubmission,
    handleDiscard,
    handleGetNext
} from '$lib/server/reviewSession'; // Import the session manager functions
import type { Actions, PageServerLoad } from './$types';

// Load initial data using the session manager
export const load: PageServerLoad = async ({ fetch }) => {
    console.log('Executing load function...');
    // Delegate fetching and error handling to reviewSession
    const result = await getInitialReviewData(fetch);
    // Pass the whole result object, including potential loadError
    return result;
};

// Define server actions, delegating logic to reviewSession
export const actions: Actions = {
    submitGrade: async ({ request, fetch }) => {
        const formData = await request.formData();
        // Add robust parsing and validation
        const thoughtId = parseInt(formData.get('thoughtId')?.toString() ?? '', 10);
        const grade = parseInt(formData.get('grade')?.toString() ?? '', 10);
        if (isNaN(thoughtId) || isNaN(grade) || grade < 1 || grade > 4) {
            return fail(400, { message: 'Invalid thought ID or grade.' });
        }

        console.log(`Action: submitGrade (id: ${thoughtId}, grade: ${grade})`);
        const result = await handleGradeSubmission(thoughtId, grade, fetch);

        if (!result.success) {
            // Use fail() with the error message from the session handler
            return fail(500, { message: result.message });
        }
        // Return the success data (including nextCard)
        return result;
    },

    discardCard: async ({ request, fetch }) => {
        const formData = await request.formData();
        const thoughtId = parseInt(formData.get('thoughtId')?.toString() ?? '', 10);

        if (isNaN(thoughtId)) {
            return fail(400, { message: 'Invalid thought ID.' });
        }

        console.log(`Action: discardCard (id: ${thoughtId})`);
        const result = await handleDiscard(thoughtId, fetch);

        if (!result.success) {
            return fail(500, { message: result.message });
        }
        return result;
    },

    getNext: async ({ fetch }) => {
        console.log(`Action: getNext`);
        const result = await handleGetNext(fetch);

        if (!result.success) {
            return fail(500, { message: result.message });
        }
        return result;
    }
};
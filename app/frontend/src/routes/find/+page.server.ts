import { env } from '$env/dynamic/private'; // To read server-side environment variables
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types'; // Add PageServerLoad
import { findThoughts } from '$lib/server/api.client';
import type { ApiError } from '$lib/types';

// --- Define Default Values ---
const DEFAULT_TEXT = `More than ever before, the Renaissance stands as one of the defining moments in world history. Between 1400 and 1600, European perceptions of society, culture, politics and even humanity itself emerged in ways that continue to affect not only Europe but the entire world.
This wide-ranging exploration of the Renaissance sees the period as a time of unprecedented intellectual excitement and cultural experimentation and interaction on a global scale, alongside a darker side of religion, intolerance, slavery, and massive inequality of wealth and status. It guides the reader through the key issues that defined the period, from its art, architecture, and literature, to advancements in the fields of science, trade, and travel. In its incisive account of the complexities of the political and religious upheavals of the period, the book argues that Europe's reciprocal relationship with its eastern neighbours offers us a timely perspective on the Renaissance that still has much to teach us today.`;
const DEFAULT_IDENTIFIER = "text_demo_1";

// --- Load Function ---
// This runs on the server before the page component is rendered
export const load: PageServerLoad = async () => {
    // Read the environment variable. Check specifically for the string 'true'.
    const isLocked = env.FRONTEND_LOCK === 'true';

    // Return the lock status and the default values.
    // This object will be available as the `data` prop in +page.svelte
    return {
        isLocked: isLocked,
        defaultText: DEFAULT_TEXT,
        defaultIdentifier: DEFAULT_IDENTIFIER
    };
};

// --- Actions Object ---
// This handles form submissions
export const actions: Actions = {
	findThoughts: async ({ request }) => {
		const formData = await request.formData();
		const text = formData.get('text') as string;
		const identifier = formData.get('identifier') as string;

        // Use the values submitted, which might be the defaults if locked
		const effectiveText = text;
        const effectiveIdentifier = identifier;

		if (!effectiveText || !effectiveIdentifier) {
			// Return submitted values along with the error
			return fail(400, {
                error: 'Text and Identifier are required.',
                text: effectiveText, // Return potentially null/empty values
                identifier: effectiveIdentifier
            });
		}

		try {
			// Call the API client function with the effective values
			const thoughts = await findThoughts(effectiveText, effectiveIdentifier);

			// Return success data, including the inputs used, for the form
			return {
                success: true,
                thoughts: thoughts,
                text: effectiveText,         // Return the text used
                identifier: effectiveIdentifier // Return the identifier used
            };

		} catch (error: unknown) {
			const apiError = error as ApiError & { status?: number }; // Type assertion remains useful
			console.error('Failed action in /find page:', apiError);

            // Use the status and message from the structured error
            // Return submitted values along with the error
			return fail(apiError.status || 500, {
                error: apiError.message || 'An unexpected error occurred.',
                text: effectiveText, // Return the text that caused the error
                identifier: effectiveIdentifier // Return the identifier that caused the error
            });
		}
	}
};
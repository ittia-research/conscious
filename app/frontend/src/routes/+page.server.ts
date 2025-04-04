import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findThoughts, configsSources } from '$lib/server/api.client';
import type { ApiError, IdentifierValues } from '$lib/types';

// Runs on the server before the page component is rendered
export const load: PageServerLoad = async () => {
    return {
        configs: configsSources
    };
}; 

// --- Actions Object ---
// This handles form submissions
export const actions: Actions = {
	findThoughts: async ({ request }) => {
		const formData = await request.formData();
		const text = formData.get('text'); // Keep as FormDataEntryValue initially
		const selectedType = formData.get('selectedType'); // Keep as FormDataEntryValue

        // Validate base types first
        if (!text || typeof text !== 'string' || text.trim() === '') {
            // Return partial data for repopulation
			return fail(400, {
                error: 'Text field cannot be empty.',
                text: '', // Keep text empty on this specific error
                selectedType: typeof selectedType === 'string' ? selectedType : null,
                identifierValues: {} // Clear identifiers if text is missing
            });
		}
        if (!selectedType || typeof selectedType !== 'string' || selectedType.trim() === '') {
             // Return partial data for repopulation
            return fail(400, {
                error: 'A source type must be selected.',
                text: text, // Keep entered text
                selectedType: null,
                identifierValues: {} // Clear identifiers if type is missing
             });
        }

        // Ensure text and selectedType are strings now
        const effectiveText = text.toString().trim();
        const effectiveSelectedType = selectedType.toString().trim();

        // --- Load configurations ---
        let configs;
        try {
            configs = await configsSources; // Reload or ensure available
        } catch (error) {
             console.error("Failed to load configuration sources during action:", error);
             return fail(500, {
                error: 'Server configuration error. Please try again later.',
                text: effectiveText,
                selectedType: effectiveSelectedType,
                identifierValues: {}
            });
        }

        // --- Determine Expected Identifier Keys ---
        const typeConfig = configs?.[effectiveSelectedType];
        const expectedKeys = typeConfig?.keys ? Object.keys(typeConfig.keys) : [];
        let identifierValues: IdentifierValues = {};
        let validationError: string | null = null;

        // --- Validate and collect identifier values ---
        for (const key of expectedKeys) {
            const formKey = `identifier_${key}`;
            const value = formData.get(formKey);
            const isRequired = typeConfig.keys[key]?.required ?? false; // Check if key is required (assuming this structure)

            if (isRequired && (!value || typeof value !== 'string' || value.trim() === '')) {
                console.log(`Missing required identifier: ${key}`);
                validationError = `Please fill in the required identifier: '${key}'.`;
                // Collect partially filled values for repopulation *before* breaking
                // Need to iterate through *all* expected keys first to get existing values
                 for (const k of expectedKeys) {
                    const v = formData.get(`identifier_${k}`);
                    if (v && typeof v === 'string') {
                         identifierValues[k] = v;
                    }
                 }
                break; // Stop checking if a required one is missing
            }

            if (value && typeof value === 'string') {
                 identifierValues[key] = value.trim();
            } else if (!value && !isRequired) {
                 // Optional field is empty, potentially assign null or omit, based on backend needs
                 // identifierValues[key] = null; // Example if backend expects null
            }
        }


        // If a validation error occurred during identifier check
        if (validationError) {
            return fail(400, {
                error: validationError,
                text: effectiveText,
                selectedType: effectiveSelectedType,
                identifierValues // Return partially filled values
            });
        }

		// --- Call the API ---
		try {
            console.debug('Calling findThoughts with:', { effectiveText, effectiveSelectedType, identifierValues });
            const thoughts = await findThoughts(
                effectiveText,
                effectiveSelectedType,
                identifierValues
            );

			// Return success data
			return {
                success: true,
                thoughts: thoughts,
                // Return the inputs used for display consistency
                text: effectiveText,
                selectedType: effectiveSelectedType,
                identifierValues: identifierValues
            };

		} catch (error: unknown) {
			const apiError = error as ApiError & { status?: number };
			console.error('Failed action in /find page (findThoughts call):', apiError);

			// Return failure data, including the inputs that caused the error
			return fail(apiError.status || 500, {
                error: apiError.message || 'An unexpected error occurred during thought retrieval.',
                text: effectiveText,
                selectedType: effectiveSelectedType,
                identifierValues: identifierValues // Return submitted identifiers on error
            });
		}
	}
};
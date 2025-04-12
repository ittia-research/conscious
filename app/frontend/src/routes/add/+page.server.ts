// src/routes/add-data/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { logger } from "$lib/server/logger";
import type { AllConfigsType, AddDataResponse } from '$lib/types';
import { getConfigs, addData } from '$lib/server/apiClient'; // Assuming addData is also exported

export const load: PageServerLoad = async ({ depends, url }) => {
    // depends('app:configs'); // Add a custom dependency identifier if configs rarely change
    logger.info('Loading configs for Add Data page');
    try {
        const configs: AllConfigsType = await getConfigs();
        // You could potentially pre-filter sources based on URL params here if needed
        // but the client-side logic already handles selection.
        return {
             configs,
             // Pass URL params to client if needed for SSR pre-population, though onMount handles it client-side
             // taskParam: url.searchParams.get('task'),
             // sourceParam: url.searchParams.get('source'),
         };
    } catch (error: any) {
        logger.error({ error }, 'Failed to load configs for Add Data page');
        return {
            configs: null,
            error: `Failed to load configurations: ${error.message || 'Unknown error'}`
        };
    }
};

export const actions: Actions = {
    default: async ({ request }) => {
        const formData = await request.formData();

        const task = formData.get('task') as string | null;
        const sourceType = formData.get('sourceType') as string | null;
        const file = formData.get('file') as File | null;
        // Get all text inputs
        const textListRaw = formData.getAll('textInput').map(val => val as string);

        // Requirement 3: Filter out empty/whitespace-only text inputs *before* validation
        const textListFiltered = textListRaw.map(t => t.trim()).filter(t => t.length > 0);

        const sourceIdentifiers: { [key: string]: string } = {};
        // Note: Fetch required identifiers from config again here for robust validation if needed,
        // or trust client-side required flags were enforced. For now, just extract provided ones.
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('identifier_')) {
                const identifierKey = key.substring('identifier_'.length);
                 // Trim identifier values as well? Usually a good idea.
                sourceIdentifiers[identifierKey] = (value as string).trim();
            }
        }

        // --- Basic Validation ---
        if (!task) {
            return fail(400, { success: false, message: 'Task is required.', field: 'task', task, sourceType, sourceIdentifiers, textInputs: textListRaw });
        }
        if (!sourceType) {
             return fail(400, { success: false, message: 'Source Type is required.', field: 'sourceType', task, sourceType, sourceIdentifiers, textInputs: textListRaw });
        }

         // --- Requirement 3: Validate that either a file OR non-empty text is provided ---
         const hasFileData = file && file.size > 0;
         const hasTextData = textListFiltered.length > 0;

         if (!hasFileData && !hasTextData) {
             logger.warn('Add data attempt failed: No file content and no valid text content provided.');
             return fail(400, {
                 success: false,
                 message: 'Please provide data either by uploading a file or entering non-empty text.',
                 field: 'data_content', // Custom field name for general data area feedback
                 task,
                 sourceType,
                 sourceIdentifiers,
                 textInputs: textListRaw // Return raw inputs for repopulation if needed
             });
         }

        // --- Process File (if present) ---
        let fileContentBytes: Uint8Array | undefined = undefined;
        let fileNameForLog: string | undefined = undefined;
        if (hasFileData) {
            try {
                const buffer = await file.arrayBuffer();
                fileContentBytes = new Uint8Array(buffer);
                fileNameForLog = file.name;
                logger.info(`Read file ${file.name} (${file.size} bytes) in server action`);
            } catch (err: any) {
                logger.error({ error: err }, "Error reading uploaded file in server action");
                 // Return field-specific error if possible
                 return fail(500, { success: false, message: `Could not read the uploaded file: ${err.message}`, field: 'file', task, sourceType, sourceIdentifiers, textInputs: textListRaw });
            }
        }

        logger.info({ intentData: {
            task: task,
            sourceType: sourceType,
            sourceIdentifiers: sourceIdentifiers, // Log trimmed identifiers
            filePresent: hasFileData,
            fileName: fileNameForLog,
            fileSize: fileContentBytes?.length,
            filteredTextListCount: textListFiltered.length, // Log count after filtering
            // Log sample of filtered text? Be careful with sensitive data.
            // filteredTextSample: textListFiltered.map(t => t.substring(0, 50))
        }}, 'Server action preparing to call addData');


        try {
            // Pass the *filtered* text list to the backend API
            const response: AddDataResponse = await addData(
                task,
                sourceType,
                sourceIdentifiers,
                fileContentBytes,
                textListFiltered // Use filtered list
            );

            logger.info({ response }, 'AddData call successful');
            // Return success state to the client
            return { success: response.success ?? true, message: response.message || 'Data added successfully!' };

        } catch (error: any) {
             logger.error({ error, task, sourceType }, 'Error executing addData from server action');
             // Try to return a generic error, or parse the error if possible
             const errorMessage = typeof error?.message === 'string' ? error.message : 'Failed to add data due to a server error.';
             return fail(500, {
                success: false,
                message: errorMessage,
                // Return form data to allow repopulation on error
                task,
                sourceType,
                sourceIdentifiers,
                textInputs: textListRaw // Return raw inputs as submitted
            });
        }
    }
};
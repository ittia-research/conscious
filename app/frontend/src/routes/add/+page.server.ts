// src/routes/add/+page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import type { AllConfigsType, AddDataResponse } from '$lib/types';
import { getConfigs } from '$lib/server/apiClient';
import { addData } from '$lib/server/apiClient';

const logger = console; // Using console for simplicity here

export const load: PageServerLoad = async ({ depends }) => {
     try {
        logger.info('Loading configs for Add Data page');
        const configs: AllConfigsType = await getConfigs();
        return { configs };
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
        const textList = formData.getAll('textInput').map(val => val as string); // Keep empty strings for now

        const sourceIdentifiers: { [key: string]: string } = {};
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('identifier_')) {
                const identifierKey = key.substring('identifier_'.length);
                sourceIdentifiers[identifierKey] = value as string;
            }
        }

        if (!task) return fail(400, { success: false, message: 'Task is required.', field: 'task' });
        if (!sourceType) return fail(400, { success: false, message: 'Source Type is required.', field: 'sourceType' });

        let fileContentBytes: Uint8Array | undefined = undefined;
        if (file && file.size > 0) {
            try {
                const buffer = await file.arrayBuffer();
                fileContentBytes = new Uint8Array(buffer);
                logger.info(`Read file ${file.name} (${file.size} bytes) in server action`);
            } catch (err: any) {
                logger.error({ error: err }, "Error reading uploaded file in server action");
                return fail(500, { success: false, message: `Could not read the uploaded file: ${err.message}` });
            }
        }

        logger.info({ intentData: {
            task: task,
            sourceType: sourceType,
            sourceIdentifiers: sourceIdentifiers,
            filePresent: !!fileContentBytes,
            fileSize: fileContentBytes?.length,
            textListCount: textList.length, // Log raw count before filtering
            // textListRawSample: textList.map(t => t.substring(0, 50)) // Log raw sample
        }}, 'Server action preparing to call addData wrapper');


        try {
            const response: AddDataResponse = await addData(
                task,
                sourceType,
                sourceIdentifiers,
                fileContentBytes,
                textList
            );

            logger.info({ response }, 'AddData call successful (returned from wrapper)');
            return { success: response.success ?? true, message: response.message || 'Data added successfully!' };

        } catch (error: any) {
            logger.error({ error }, 'Error executing addData wrapper from server action');
            return fail(500, { success: false, message: error.message || 'Failed to add data.' });
        }
    }
};
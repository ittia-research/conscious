import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// For debug: check request and header details
const requestHook: Handle = async ({ event, resolve }) => {
    console.log(' '); // Add one line of space
    console.log('--- Request Hook Start ---');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Request Method: ${event.request.method}`);
    console.log(`Request URL: ${event.url.toString()}`);

    console.log('All Incoming Headers:');
    for (const [key, value] of event.request.headers.entries()) {
        console.log(`  ${key}: ${value}`);
    }

    const response = await resolve(event);

    console.log(`Response Status: ${response.status}`);
    console.log('--- Request Hook End ---');
    return response;
};

// export const handle = sequence(requestHook);

import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

// src/hooks.server.ts
import { createContext } from '$lib/server/trpc/context';
import { router } from '$lib/server/trpc/router';
// Use the WebSocket handler from trpc-sveltekit
import { createTRPCWebSocketServer } from "trpc-sveltekit/websocket";
import { building } from '$app/environment';

// IMPORTANT: Only create the WebSocket server when not building/prerendering
if (!building) {
    console.log('Creating tRPC WebSocket server...');
    createTRPCWebSocketServer({
        router,
        createContext,
        // Optional: configure WebSocket server options if needed
        // wssOptions: { ... }
    });
    console.log('tRPC WebSocket server created.');
} else {
    console.log('Skipping tRPC WebSocket server creation during build.');
}

// Note: The standard HTTP handle (`createTRPCHandle`) is NOT used
// when using the WebSocket approach provided by trpc-sveltekit,
// as it handles all tRPC traffic over WebSockets.
// If you need *both* HTTP and WS, you might need a more complex setup
// or wait for official SvelteKit WebSocket support.

// You might still need a handle function for other things (e.g., auth)
// import type { Handle } from '@sveltejs/kit';
// export const handle: Handle = async ({ event, resolve }) => {
//   // Your custom logic here (e.g., setting locals.user)
//   return resolve(event);
// };

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

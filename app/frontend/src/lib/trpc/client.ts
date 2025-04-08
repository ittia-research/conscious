// src/lib/trpc/client.ts
import type { Router } from '$lib/server/trpc/router'; // Use server router type
// Use the WebSocket client creator
import { createTRPCWebSocketClient } from "trpc-sveltekit/websocket";
import type { TRPCClientInit } from 'trpc-sveltekit'; // For init options type if needed

let browserClient: ReturnType<typeof createTRPCWebSocketClient<Router>>;

// Note: The 'init' parameter (for passing fetch) is less relevant
// with WebSockets as the connection is persistent and doesn't use fetch per-request.
export function trpc(init?: TRPCClientInit) { // Keep init optional if you might need it elsewhere
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser && browserClient) {
        return browserClient;
    }
    // Create the WebSocket client instance
    const client = createTRPCWebSocketClient<Router>({
        // Optional: Add WebSocket client options if needed
        // url: 'ws://localhost:5173/trpc', // Default URL derived by trpc-sveltekit is usually fine
    });
    if (isBrowser) {
        browserClient = client;
    }
    return client;
}

// Type helper for subscription outputs (optional but good practice)
import type { inferObservableValue } from '@trpc/server/observable';

// This type definition correctly infers the output type from the router.
// Since the router's audioStream now outputs a 'string' (Base64 Opus/WebM),
// this type will correctly resolve to 'string'.
export type AudioStreamOutput = inferObservableValue<Router['audioStream']['output']>;
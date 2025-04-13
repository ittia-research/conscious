// src/lib/trpc/client.ts
import type { Router } from '$lib/server/trpc/router'; // Use **UPDATED** server router type
import { createTRPCWebSocketClient } from "trpc-sveltekit/websocket";
import type { TRPCClientInit } from 'trpc-sveltekit';
import type { inferRouterOutputs } from '@trpc/server'; // Helper for output types

let browserClient: ReturnType<typeof createTRPCWebSocketClient<Router>>;

export function trpc(init?: TRPCClientInit) {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser && browserClient) {
        return browserClient;
    }
    const client = createTRPCWebSocketClient<Router>(); // Router type is key
    if (isBrowser) {
        browserClient = client;
    }
    return client;
}

// Optional: Define helper types for specific procedure outputs
type RouterOutput = inferRouterOutputs<Router>;
export type AudioQueryResult = RouterOutput['getAudioForText'];
export type NextCardQueryResult = RouterOutput['getNextReviewCardClient'];
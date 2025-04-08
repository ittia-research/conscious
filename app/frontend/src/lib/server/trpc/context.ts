// src/lib/server/trpc/context.ts
import type { RequestEvent } from '@sveltejs/kit';
import type { inferAsyncReturnType } from '@trpc/server';
// Potentially import your gRPC client or other dependencies if needed globally
// import { grpcClient } from '$lib/server/ttsGrpcClient';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createContext(event: RequestEvent) {
    // Context can hold user session, db connections, etc.
    // For now, it's simple, but could pass `fetch` or auth details.
    return {
        // user: event.locals.user, // Example if you have auth
    };
}

export type Context = inferAsyncReturnType<typeof createContext>;
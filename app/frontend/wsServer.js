// wsServer.js
import { SvelteKitTRPCWSServer } from "trpc-sveltekit/websocket";

// This initializes the WebSocket server shim for production builds
SvelteKitTRPCWSServer(import.meta.url);

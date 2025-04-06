// src/lib/server/apiClient.ts

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { promisify } from 'util';
import path from 'path';
import { env } from '$env/dynamic/private';
// BEST PRACTICE: Consider using a structured logger like 'pino' or 'winston' for production
// import pino from 'pino';
// const logger = pino({ level: env.LOG_LEVEL || 'info' });
// Replace console.log/info/error with logger.info/error etc.
const logger = console; // Using console for simplicity here

// --- Generated Types ---
// Ensure these paths correctly point to your ts-proto output directory
import type {
    FindServiceClient,
    ConfigServiceClient,
    ReviewServiceClient,
    // HealthClient // Uncomment if you implement health checks
} from './grpc/generated/conscious_api'; // Main service client interfaces
import {
    FindThoughtsRequest,
    FindThoughtsResponse,
    GetConfigsRequest,
    GetConfigsResponse,
    GetNextReviewCardResponse,
    SubmitReviewGradeRequest,
    ReviewUpdateResponse,
    DiscardThoughtRequest,
    DiscardThoughtResponse,
    HealthCheckRequest,
    HealthCheckResponse,
    // google_rpc_Status, // Import if you implement rich error detail parsing
} from './grpc/generated/conscious_api'; // Message types
import type { Struct } from './grpc/generated/google/protobuf/struct';
import type { Timestamp } from './grpc/generated/google/protobuf/timestamp';
// import { Value } from './grpc/generated/google/protobuf/struct'; // May be needed for advanced structToObject

// --- Custom SvelteKit Types ---
import type {
    ConfigsType,
    ApiError,
    IdentifierValues,
    ReviewCardResponse as UIReviewCardResponse
} from '$lib/types';

// --- Configuration ---
const GRPC_SERVER_ADDRESS = env.BACKEND_API_BASE; // e.g., "localhost:50051" or "grpcs://api.example.com"
const API_KEY = env.BACKEND_API_KEY;
const GRPC_CALL_TIMEOUT_MS = parseInt(env.GRPC_CALL_TIMEOUT_MS || '5000', 10); // Default 5 seconds
const CONFIG_CACHE_TTL_MS = parseInt(env.CONFIG_CACHE_TTL_MS || '300000', 10); // Default 5 minutes

if (!GRPC_SERVER_ADDRESS || !API_KEY) {
    logger.error('FATAL: GRPC_SERVER_ADDRESS or BACKEND_API_KEY environment variable is not configured.');
    throw new Error('Server configuration error: Missing backend API credentials or address.');
}

const useTls = GRPC_SERVER_ADDRESS.startsWith('grpcs://');
// REFINEMENT: Construct the final address string *after* checking the prefix
const resolvedGrpcAddress = GRPC_SERVER_ADDRESS.replace(/^grpcs?:\/\//, '');

// REFINEMENT: Centralize proto path resolution.
const protoBasePath = path.resolve(process.cwd(), 'src/protos');
const mainProtoPath = path.join(protoBasePath, 'conscious_api.proto');
// REFINEMENT: Explicitly include directory for potential google protobuf imports if needed
const includeDirs = [protoBasePath, path.resolve(process.cwd(), 'node_modules/@grpc/proto-loader/build/proto_assets')]; // Adjust second path if needed


// --- gRPC Setup ---
let packageDefinition: protoLoader.PackageDefinition;
try {
    packageDefinition = protoLoader.loadSync(mainProtoPath, {
        keepCase: true, // Keep field names as defined in proto
        longs: String,  // Use String for 64-bit integers (safer in JS)
        enums: String,  // Use string names for enums
        defaults: true, // Set default values for missing fields
        oneofs: true,   // Represent oneof fields as virtual properties
        includeDirs: includeDirs, // Help loader find imported protos (like google/protobuf/timestamp.proto)
    });
} catch (err: any) {
    logger.error(`FATAL: Failed to load proto file at ${mainProtoPath}. Include Dirs: ${includeDirs.join(', ')}. Error: ${err.message}`);
    throw new Error(`Proto definition loading failed: ${err.message}`);
}

// REFINEMENT: Use type assertion for better type safety downstream
const consciousPackage = grpc.loadPackageDefinition(packageDefinition).conscious?.v1 as grpc.GrpcObject | undefined;

// REFINEMENT: More robust check for loaded package and services
if (!consciousPackage?.FindService || !consciousPackage?.ConfigService || !consciousPackage?.ReviewService /* || !consciousPackage.Health */ ) {
     logger.error(`FATAL: Failed to load gRPC package definition or required services (FindService, ConfigService, ReviewService) from ${mainProtoPath}. Check package name ('conscious.v1') and proto validity.`);
     throw new Error(`Failed to load gRPC services.`);
}

const credentials = useTls
    ? grpc.credentials.createSsl() // PRODUCTION BEST PRACTICE: Use SSL for non-local connections
    : grpc.credentials.createInsecure();
logger.info(`gRPC client connecting to ${resolvedGrpcAddress} using ${useTls ? 'secure (SSL)' : 'insecure'} credentials.`);


// --- Metadata ---
function createAuthMetadata(): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.set('authorization', `Bearer ${API_KEY}`);
    // Add other common metadata if needed (e.g., client version, request ID)
    // metadata.set('x-request-id', crypto.randomUUID());
    return metadata;
}

// REFINEMENT: Add deadline option to metadata for timeout control
function createCallOptions(timeoutMs: number = GRPC_CALL_TIMEOUT_MS): grpc.CallOptions {
    return { deadline: Date.now() + timeoutMs };
}

// --- Type Conversion Helpers ---
function timestampToDate(ts: Timestamp | undefined | null): Date | null {
    if (!ts || ts.seconds == null || ts.nanos == null) {
        return null;
    }
    // REFINEMENT: Ensure seconds/nanos are numbers before calculation
    const seconds = typeof ts.seconds === 'string' ? parseInt(ts.seconds, 10) : Number(ts.seconds);
    const nanos = typeof ts.nanos === 'number' ? ts.nanos : 0;

    if (isNaN(seconds)) {
        logger.warn('Invalid seconds value received in Timestamp:', ts.seconds);
        return null;
    }

    return new Date(seconds * 1000 + nanos / 1000000);
}

// REFINEMENT: More robust Struct to Object conversion, handling more types.
// Consider libraries like 'protobufjs' for more comprehensive conversion if needed.
function convertProtoValue(valueWrapper: any): any {
     // Order matters: check for specific types before fallback/generic types
    if (valueWrapper.nullValue !== undefined && valueWrapper.nullValue === null) { // Note: proto3 nullValue is an enum
        return null;
    } else if (valueWrapper.numberValue !== undefined && valueWrapper.numberValue !== null) {
        return valueWrapper.numberValue;
    } else if (valueWrapper.stringValue !== undefined && valueWrapper.stringValue !== null) {
        return valueWrapper.stringValue;
    } else if (valueWrapper.boolValue !== undefined && valueWrapper.boolValue !== null) {
        return valueWrapper.boolValue;
    } else if (valueWrapper.structValue) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return structToObject(valueWrapper.structValue); // Recursive call
    } else if (valueWrapper.listValue?.values) {
        return valueWrapper.listValue.values.map(convertProtoValue); // Recursive call for list items
    }
    logger.warn("Unhandled protobuf Value kind:", Object.keys(valueWrapper)[0]); // Log if a type isn't handled
    return undefined; // Or throw error, depending on desired strictness
}

function structToObject(struct: Struct | undefined | null): Record<string, any> | null {
     if (!struct || !struct.fields) return null;

    const obj: Record<string, any> = {};
    for (const key in struct.fields) {
        if (Object.prototype.hasOwnProperty.call(struct.fields, key)) {
            obj[key] = convertProtoValue(struct.fields[key]);
        }
    }
    return obj;
}


// --- Error Handling ---
// REFINEMENT: Define a more specific type for gRPC errors based on grpc-js
interface GrpcJsError extends Error {
    code: grpc.status;
    details: string;
    metadata?: grpc.Metadata; // Metadata might not always be present
}

// PRODUCTION BEST PRACTICE: Implement parsing for rich error details (google.rpc.Status)
function parseRichErrorDetails(metadata: grpc.Metadata | undefined): any | null {
    if (!metadata) return null;
    const statusDetailsBin = metadata.get('grpc-status-details-bin');
    if (statusDetailsBin && statusDetailsBin[0] instanceof Buffer) {
        try {
            // Assumes you have generated types for google.rpc.Status using ts-proto
            // Need: import { Status } from './grpc/generated/google/rpc/status'; // Adjust path
            // const status = Status.decode(statusDetailsBin[0]);
            // logger.info({ grpcStatusDetails: status }, "Decoded rich gRPC error details");
            // return status; // Return the decoded status object
            logger.warn("Rich error detail parsing ('grpc-status-details-bin') is present but decoding is not fully implemented.");
            return null; // Placeholder
        } catch (parseErr: any) {
            logger.error({ err: parseErr }, "Failed to parse rich gRPC error details (grpc-status-details-bin)");
        }
    }
    return null;
}

function handleGrpcError(error: any, context: string): never {
    // REFINEMENT: Improved check for gRPC-like errors
    const isLikelyGrpcError = typeof error === 'object' && error !== null && typeof error.code === 'number' && typeof error.details === 'string';

    if (!isLikelyGrpcError) {
        logger.error({ err: error, context }, `Non-gRPC error encountered in ${context}`);
        throw {
            status: 500,
            message: `An unexpected error occurred (${context}): ${error?.message || 'Unknown internal error'}`,
            details: String(error) // Avoid leaking sensitive details in production if possible
        } satisfies ApiError; // Use 'satisfies' for better type checking
    }

    const grpcError = error as GrpcJsError; // Cast now safe
    const richDetails = parseRichErrorDetails(grpcError.metadata); // Attempt to get richer details

    logger.error(
        {
            context,
            grpcCode: grpcError.code,
            grpcStatus: grpc.status[grpcError.code] ?? 'UNKNOWN_STATUS',
            grpcDetails: grpcError.details,
            // Include rich details if parsed
            ...(richDetails && { grpcRichDetails: richDetails })
        },
        `gRPC Error in ${context}`
    );

    let statusCode = 500; // Default to Internal Server Error
    let message = `Service Error (${context}): ${grpcError.details || 'Communication failure with backend service'}`;

    switch (grpcError.code) {
        case grpc.status.INVALID_ARGUMENT: statusCode = 400; break;
        case grpc.status.NOT_FOUND: statusCode = 404; break;
        case grpc.status.ALREADY_EXISTS: statusCode = 409; break;
        case grpc.status.PERMISSION_DENIED: statusCode = 403; break;
        case grpc.status.UNAUTHENTICATED: statusCode = 401; break;
        case grpc.status.UNAVAILABLE: statusCode = 503; message = `Service temporarily unavailable (${context}). Please try again later.`; break;
        case grpc.status.CANCELLED: statusCode = 499; message = "Request cancelled by the client."; break; // 499 Client Closed Request (common proxy status)
        case grpc.status.DEADLINE_EXCEEDED: statusCode = 504; message = "Request timed out waiting for backend service."; break;
        // Add more specific mappings as needed
        default: message = `An unexpected service error occurred (${context}). gRPC Code: ${grpcError.code}`; break;
    }

    const apiError: ApiError = {
        status: statusCode,
        message,
        details: `gRPC Error: ${grpc.status[grpcError.code] || grpcError.code}` // Provide code name/number for reference
    };
    throw apiError;
}


// --- Client Instantiation (Singleton Pattern) ---
interface ServiceClients {
    find: FindServiceClient;
    config: ConfigServiceClient;
    review: ReviewServiceClient;
    // health?: HealthClient; // Optional if implemented
    closeAll: () => void; // Add a function to close clients
}

let clients: ServiceClients | null = null;

function getClients(): ServiceClients {
    if (clients) {
        return clients;
    }

    // Type alias for cleaner promisified unary call signature
    // REFINEMENT: Include CallOptions in the signature for timeouts/deadlines
    type PromisifiedUnary<Req, Res> = (
        request: Req,
        metadata: grpc.Metadata,
        options: grpc.CallOptions
    ) => Promise<Res>;

    // --- Instantiate Raw gRPC Clients ---
    // REFINEMENT: Add channel options (e.g., keepalive) if needed for production stability
    const channelOptions = {
        'grpc.keepalive_time_ms': 120000, // Send keepalive ping every 2 minutes
        'grpc.keepalive_timeout_ms': 20000, // Wait 20 seconds for pong response
        'grpc.keepalive_permit_without_calls': 1, // Allow keepalive pings when there are no calls
        'grpc.http2.min_time_between_pings_ms': 60000, // Minimum time between pings
        'grpc.http2.max_pings_without_data': 0, // Allow pings even without data
    };

    const findGrpcClient = new (consciousPackage!.FindService as grpc.ServiceClientConstructor)(
        resolvedGrpcAddress, credentials, channelOptions);
    const configGrpcClient = new (consciousPackage!.ConfigService as grpc.ServiceClientConstructor)(
        resolvedGrpcAddress, credentials, channelOptions);
    const reviewGrpcClient = new (consciousPackage!.ReviewService as grpc.ServiceClientConstructor)(
        resolvedGrpcAddress, credentials, channelOptions);
    // const healthGrpcClient = new ...

    // BEST PRACTICE: Provide a way to close clients for graceful shutdown
    const closeAllClients = () => {
        logger.info("Closing gRPC client connections...");
        findGrpcClient.close();
        configGrpcClient.close();
        reviewGrpcClient.close();
        // healthGrpcClient?.close();
        clients = null; // Allow re-creation if needed after close
        logger.info("gRPC clients closed.");
    };

    // Use an IIFE to create the promisified clients structure
    clients = (() => {
        // Helper to promisify with correct binding and type safety
        function promisifyClientMethod<Req, Res>(method: Function): PromisifiedUnary<Req, Res> {
             // Bind the method to its client instance BEFORE promisifying
             // The type cast is necessary because promisify loses specific argument/return types
             return promisify(method.bind(findGrpcClient)) as PromisifiedUnary<Req, Res>;
        }

        return {
            find: {
                // Ensure the method name matches the proto definition (case sensitive if keepCase=true)
                findThoughts: promisifyClientMethod<FindThoughtsRequest, FindThoughtsResponse>(findGrpcClient.findThoughts),
            } as FindServiceClient, // Cast needed because we create a partial object matching the interface
            config: {
                getConfigs: promisifyClientMethod<GetConfigsRequest, GetConfigsResponse>(configGrpcClient.getConfigs),
            } as ConfigServiceClient,
            review: {
                // For Empty request type, use {} or object in TS, but the method signature expects it.
                // The promisified version still needs the placeholder arg.
                getNextReviewCard: promisifyClientMethod<{}, GetNextReviewCardResponse>(reviewGrpcClient.getNextReviewCard),
                submitReviewGrade: promisifyClientMethod<SubmitReviewGradeRequest, ReviewUpdateResponse>(reviewGrpcClient.submitReviewGrade),
                discardThought: promisifyClientMethod<DiscardThoughtRequest, DiscardThoughtResponse>(reviewGrpcClient.discardThought),
            } as ReviewServiceClient,
            // health: { ... },
            closeAll: closeAllClients,
        };
    })();


    // PRODUCTION BEST PRACTICE: Handle graceful shutdown
    // Register shutdown hooks to close clients when the SvelteKit server stops
    // This depends on your deployment environment (Node, Docker, etc.)
    // Example for generic Node:
    process.on('SIGTERM', () => {
        logger.info('SIGTERM signal received. Closing gRPC clients...');
        clients?.closeAll();
        process.exit(0); // Exit gracefully
    });
    process.on('SIGINT', () => { // Handle Ctrl+C
        logger.info('SIGINT signal received. Closing gRPC clients...');
        clients?.closeAll();
        process.exit(0);
    });


    return clients;
}


// --- API Functions ---

// REFINEMENT: Add timeouts/deadlines to all API calls using CallOptions

export async function findThoughts(text: string, type: string, identifiers: IdentifierValues): Promise<string[]> {
    const client = getClients().find;
    const metadata = createAuthMetadata();
    const options = createCallOptions(); // Use default timeout

    // REFINEMENT: Ensure request structure strictly matches generated type
    const request: FindThoughtsRequest = {
        text,
        type,
        // Ensure identifiers is always an object, even if empty
        identifiers: identifiers ?? {},
    };

    try {
        logger.info({ request }, 'Calling findThoughts gRPC method');
        const response = await client.findThoughts(request, metadata, options);
        // REFINEMENT: Use nullish coalescing for safety, even if defaults=true in loader
        return response.thoughts ?? [];
    } catch (error: any) {
        // handleGrpcError always throws, so no return needed here
        handleGrpcError(error, 'findThoughts');
    }
}

// == Get configs of sources with caching ==
interface CachedConfig {
    data: ConfigsType;
    timestamp: number;
}
let cachedConfigs: CachedConfig | null = null;
let fetchPromise: Promise<ConfigsType> | null = null; // For preventing race conditions

export async function getConfigsSources(): Promise<ConfigsType> {
    const now = Date.now();
    // Check cache validity (data exists and TTL hasn't expired)
    if (cachedConfigs !== null && (now - cachedConfigs.timestamp < CONFIG_CACHE_TTL_MS)) {
        logger.info('Returning cached configs');
        return cachedConfigs.data;
    }

    // If fetch is already in progress, wait for it
    if (fetchPromise !== null) {
        logger.info('Waiting for existing config fetch operation');
        return fetchPromise;
    }

    logger.info('Initiating gRPC config fetch (cache miss or expired)...');
    fetchPromise = (async (): Promise<ConfigsType> => {
        const client = getClients().config;
        const metadata = createAuthMetadata();
        // REFINEMENT: Use a potentially shorter timeout for config requests?
        const options = createCallOptions(3000); // Example: 3 second timeout
        const request: GetConfigsRequest = { config_type: 'sources' };

        try {
            const response = await client.getConfigs(request, metadata, options);
            // REFINEMENT: Default to empty object if conversion fails or response is empty
            const configsObject = structToObject(response.configs) ?? {};

            // Update cache
            cachedConfigs = { data: configsObject, timestamp: Date.now() };
            logger.info('gRPC Configs fetched and cached successfully.');
            fetchPromise = null; // Clear the promise lock
            return configsObject;
        } catch (error: any) {
            fetchPromise = null; // Clear the promise lock on error too
            // Don't cache failures. Allow retry on next call.
            cachedConfigs = null; // Invalidate cache on error
            logger.error('Error fetching gRPC configs, cache invalidated.');
            handleGrpcError(error, 'getConfigsSources');
        }
    })();

    return fetchPromise;
}

// -- Discard a card --
export async function discardCard(thoughtId: number): Promise<DiscardThoughtResponse> {
    const client = getClients().review;
    const metadata = createAuthMetadata();
    const options = createCallOptions();

    // Convert number to string because proto 'int64' is mapped to 'string' by `longs: String`
    const request: DiscardThoughtRequest = { thought_id: String(thoughtId) };

    try {
        logger.info({ request }, 'Calling discardThought gRPC method');
        // Response ID will also be a string here if it's int64
        const response = await client.discardThought(request, metadata, options);
        return response;
    } catch (error: any) {
        handleGrpcError(error, 'discardCard');
    }
}

// -- Get next card --
export async function getNextReviewCard(): Promise<UIReviewCardResponse | null> {
    const client = getClients().review;
    const metadata = createAuthMetadata();
    const options = createCallOptions();
    // Pass an empty object `{}` for google.protobuf.Empty requests
    const request = {};

    try {
        logger.info('Calling getNextReviewCard gRPC method');
        const response = await client.getNextReviewCard(request, metadata, options);

        // REFINEMENT: Check card exists *before* accessing its properties
        if (response.card_available && response.card) {
             // Convert string ID back to number for UI/internal consistency, ensure it's a valid number
             const numericThoughtId = Number(response.card.thought_id);
             if (isNaN(numericThoughtId)) {
                 logger.error({ cardId: response.card.thought_id }, "Received non-numeric thought_id string from getNextReviewCard");
                 // Decide how to handle: return null, throw, use a default? Returning null seems safest.
                 return null;
             }
             return {
                 thought_id: numericThoughtId,
                 text: response.card.text ?? '', // Handle potentially undefined text
                 // Map other fields from response.card to UIReviewCardResponse if necessary
             };
        } else {
            logger.info('No review card available from getNextReviewCard');
            return null; // Explicitly return null when no card is available
        }
    } catch (error: any) {
        handleGrpcError(error, 'getNextReviewCard');
    }
}

// -- Submit card review grade --
export async function submitReviewGrade(thoughtId: number, grade: number): Promise<ReviewUpdateResponse> {
    const client = getClients().review;
    const metadata = createAuthMetadata();
    const options = createCallOptions();

    const request: SubmitReviewGradeRequest = {
        thought_id: String(thoughtId), // Convert number to string for int64
        grade: grade, // Assuming 'grade' in proto is int32 or similar, not int64
     };

    try {
        logger.info({ request }, 'Calling submitReviewGrade gRPC method');
        // The response might contain Timestamps or other types needing conversion
        // If ReviewUpdateResponse contains a Timestamp, the caller might need to convert it using timestampToDate
        const response = await client.submitReviewGrade(request, metadata, options);
        return response;
    } catch (error: any) {
        handleGrpcError(error, 'submitReviewGrade');
    }
}

// --- Optional: Health Check ---
// Uncomment and implement if your backend service supports gRPC Health Checking Protocol
/*
export async function checkBackendHealth(service: string = ""): Promise<HealthCheckResponse> {
    const healthClient = getClients().health;
    if (!healthClient) {
        logger.warn("Health check requested, but HealthClient is not configured/implemented.");
        // Return a dummy "UNKNOWN" status or throw an error
         return { status: 'UNKNOWN' }; // Match HealthCheckResponse enum/string type
        // OR throw new Error("Health client not available");
    }

    const metadata = createAuthMetadata(); // Health checks might not need auth? Check service requirements.
    const options = createCallOptions(1000); // Use a short timeout for health checks
    const request: HealthCheckRequest = { service }; // Empty string checks overall health

    try {
        logger.info({ request }, 'Calling checkBackendHealth gRPC method');
        const response = await healthClient.check(request, metadata, options);
        logger.info({ service, status: response.status }, "Health Check Status:");
        return response;
    } catch (error: any) {
        // Don't use handleGrpcError directly if you want specific health check failure handling
        logger.error({ err: error, context: 'checkBackendHealth' }, `Health check failed for service: '${service}'`);
         // Map specific gRPC errors (like UNAVAILABLE) to specific HealthCheckStatus enums
         if (error.code === grpc.status.UNAVAILABLE) {
            return { status: 'NOT_SERVING' }; // Or appropriate status from your enum
         }
         // Return a general failure status
         return { status: 'UNKNOWN' }; // Or 'NOT_SERVING'
        // Alternatively, re-throw using handleGrpcError if standard error handling is desired
        // handleGrpcError(error, `checkBackendHealth(service=${service})`);
    }
}
*/
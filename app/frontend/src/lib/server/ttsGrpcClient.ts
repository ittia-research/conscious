// src/lib/server/ttsGrpcClient.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { env } from '$env/dynamic/private';
import path from 'path';

// --- Configuration ---
const GATEWAY_ADDRESS = env.SPEAK_GRPC_ADDRESS || 'localhost:30051';
const protoBasePath = path.resolve(process.cwd(), 'src/lib/server/protos');
const PROTO_PATH = path.join(protoBasePath, 'gateway.proto');

// Define types based on gateway.proto
// We'll use the string representation for the enum when sending
interface SynthesizeRequest {
    target_text: string;
    output_format: string; // Use string for enum based on protoLoader settings
}

export interface AudioChunk {
    audio_data: Buffer; // Node.js Buffer holds raw bytes
}

interface AudioGatewayClient extends grpc.Client {
    SynthesizeSpeech: (request: SynthesizeRequest) => grpc.ClientReadableStream<AudioChunk>;
}

// Enum values as strings (matching the .proto definition)
const OutputFormat = {
  OUTPUT_FORMAT_UNSPECIFIED: "OUTPUT_FORMAT_UNSPECIFIED",
  OUTPUT_FORMAT_WAV_PCM_FLOAT32: "OUTPUT_FORMAT_WAV_PCM_FLOAT32",
  OUTPUT_FORMAT_OPUS_WEBM: "OUTPUT_FORMAT_OPUS_WEBM"
} as const; // Use 'as const' for better type safety if needed elsewhere

// --- Load Proto ---
let grpcClient: AudioGatewayClient | null = null;
let gatewayProto: any = null;

try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String, // Important: Use String representation for enums
        defaults: true,
        oneofs: true,
    });
    gatewayProto = grpc.loadPackageDefinition(packageDefinition).gateway;

    if (!gatewayProto || !gatewayProto.AudioGateway) {
        throw new Error("Failed to load gateway.proto or AudioGateway service not found.");
    }

    // --- Create Client ---
    const credentials = grpc.credentials.createInsecure();
    // Add channel options if needed (e.g., for large messages, keepalive)
    // const options = { 'grpc.max_receive_message_length': -1, 'grpc.keepalive_time_ms': 10000 };
    grpcClient = new gatewayProto.AudioGateway(
        GATEWAY_ADDRESS,
        credentials
        /* options */
    ) as AudioGatewayClient;

    console.log(`gRPC client configured for: ${GATEWAY_ADDRESS}`);

} catch (error) {
    console.error("Failed to initialize gRPC client:", error);
    grpcClient = null; // Ensure client is null on error
}

// --- Health Check (Remains the same) ---
export function checkGrpcConnection(): Promise<boolean> {
    if (!grpcClient) {
        console.error('gRPC connection check failed: Client not initialized.');
        return Promise.resolve(false);
    }
    return new Promise((resolve) => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + 5);
        grpcClient!.waitForReady(deadline, (error) => {
            if (error) {
                console.error('gRPC connection check failed:', error.message);
                resolve(false);
            } else {
                console.log('gRPC connection check successful.');
                resolve(true);
            }
        });
    });
}

// --- Export the function to interact with the service ---
export function synthesizeSpeechGrpc(text: string): grpc.ClientReadableStream<AudioChunk> | null {
     if (!grpcClient) {
        console.error('gRPC client not initialized');
        return null;
     }
     try {
        const request: SynthesizeRequest = {
            target_text: text,
            // Request Opus/WebM format using the string enum value
            output_format: OutputFormat.OUTPUT_FORMAT_OPUS_WEBM
        };
        console.log(`Requesting speech synthesis (Opus/WebM) for text (start): "${text.substring(0, 50)}..."`);
        return grpcClient.SynthesizeSpeech(request);

    } catch (error) {
        // Catch potential errors during request creation (though unlikely here)
        console.error('Error creating gRPC SynthesizeSpeech request object:', error);
        return null;
    }
    // Note: Errors during the actual gRPC call (like connection issues)
    // will be emitted on the returned stream's 'error' event.
}
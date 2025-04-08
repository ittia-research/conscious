// src/lib/server/trpc/router.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import type { Context } from '$lib/server/trpc/context';
import { z } from 'zod';
import { synthesizeSpeechGrpc, type AudioChunk as GrpcAudioChunk } from '$lib/server/ttsGrpcClient';
import * as grpc from '@grpc/grpc-js';

// Define the output type expected by the client (Base64 encoded Opus/WebM)
// This should match the definition in $lib/trpc/client.ts or similar shared location
export type OpusWebmBase64 = string;

export const t = initTRPC.context<Context>().create();

export const router = t.router({
    greeting: t.procedure.query(async () => {
        return `Hello from tRPC!`;
    }),

    // Subscription for streaming Opus/WebM audio
    audioStream: t.procedure
        .input(
            z.object({
                text: z.string().min(1),
            })
        )
        .subscription(({ input }) => {
            // Return an observable emitting Base64 encoded Opus/WebM chunks
            return observable<OpusWebmBase64>((emit) => {
                console.log(`[tRPC Sub] Requesting TTS stream (Opus/WebM) for text: "${input.text.substring(0, 50)}..."`);
                const grpcStream = synthesizeSpeechGrpc(input.text);

                if (!grpcStream) {
                    console.error('[tRPC Sub] Failed to initialize gRPC stream.');
                    emit.error(new TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Could not initiate speech synthesis stream.',
                    }));
                    return;
                }

                let isCancelled = false;

                // Handle incoming Opus/WebM chunks from gRPC
                grpcStream.on('data', (chunk: GrpcAudioChunk) => {
                    if (isCancelled) return;

                    try {
                        const opusWebmBuffer: Buffer = chunk.audio_data; // Buffer containing Opus/WebM bytes

                        if (!opusWebmBuffer || opusWebmBuffer.length === 0) {
                            // console.debug('[tRPC Sub] Received empty Opus/WebM chunk. Skipping.');
                            return;
                        }

                        // Encode the raw Opus/WebM buffer to Base64
                        const base64Audio = opusWebmBuffer.toString('base64');
                        emit.next(base64Audio); // Send Base64 encoded Opus/WebM data

                    } catch (processingError) {
                        console.error("[tRPC Sub] Error processing Opus/WebM data:", processingError);
                        emit.error(new TRPCError({
                             code: 'INTERNAL_SERVER_ERROR',
                             message: 'Failed to process audio data.',
                             cause: processingError,
                        }));
                        if (grpcStream && typeof grpcStream.cancel === 'function') {
                           grpcStream.cancel();
                        }
                        isCancelled = true;
                    }
                });

                // Handle stream end (remains the same)
                grpcStream.on('end', () => {
                    if (isCancelled) return;
                    console.log('[tRPC Sub] gRPC stream ended normally.');
                    emit.complete();
                    isCancelled = true;
                });

                // Handle errors (remains mostly the same, adjust messages if needed)
                grpcStream.on('error', (error: Error & { code?: number; details?: string }) => {
                    if (isCancelled) return;
                    isCancelled = true;

                    if (error.code === grpc.status.CANCELLED) {
                        console.log('[tRPC Sub] gRPC stream cancelled (likely client unsubscribe).');
                        emit.complete();
                        return;
                    }

                    console.error('[tRPC Sub] gRPC stream error:', error);
                    let trpcErrorCode: TRPCError['code'] = 'INTERNAL_SERVER_ERROR';
                    if (error.code === grpc.status.UNAVAILABLE) {
                       trpcErrorCode = 'TIMEOUT';
                    } else if (error.code === grpc.status.INVALID_ARGUMENT) {
                        trpcErrorCode = 'BAD_REQUEST';
                    }
                    // Add mapping for FAILED_PRECONDITION if gateway reports FFmpeg missing?
                    else if (error.code === grpc.status.FAILED_PRECONDITION) {
                        trpcErrorCode = 'PRECONDITION_FAILED'; // Or map to INTERNAL_SERVER_ERROR
                    }


                    emit.error(new TRPCError({
                        code: trpcErrorCode,
                        message: `Speech synthesis failed: ${error.details || error.message}`,
                        cause: error,
                    }));
                });

                // Cleanup function (remains the same)
                return () => {
                    if (!isCancelled) {
                         console.log('[tRPC Sub] Client unsubscribed. Cancelling gRPC stream.');
                         isCancelled = true;
                         if (grpcStream && typeof grpcStream.cancel === 'function') {
                             grpcStream.cancel();
                         }
                    }
                };
            });
        }),
});

export type Router = typeof router;

// Ensure you define/export OpusWebmBase64 in a shared client types file, e.g.:
// export type AudioStreamOutput = string; // Represents Base64 encoded Opus/WebM
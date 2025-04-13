// src/lib/server/trpc/router.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { synthesizeSpeechGrpc, type AudioChunk } from '$lib/server/ttsGrpcClient';
import { getNextReviewCards } from '$lib/server/apiClient'; // Import the necessary API client function
import type { ReviewCardResponse } from '$lib/types';

const DEFAULT_CARD_FETCH_COUNT = 3;

// Assuming you have context setup if needed, otherwise basic setup:
const t = initTRPC.create();

// Helper to buffer gRPC stream
async function bufferGrpcStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: AudioChunk) => {
            if (chunk.audio_data) {
                chunks.push(chunk.audio_data);
            }
        });
        stream.on('error', (err) => {
            console.error('[TRPC Router - bufferGrpcStream] gRPC stream error:', err);
            reject(new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `TTS service stream error: ${err.message}`,
                cause: err,
            }));
        });
        stream.on('end', () => {
            console.log(`[TRPC Router - bufferGrpcStream] gRPC stream ended. Total chunks: ${chunks.length}`);
            resolve(Buffer.concat(chunks));
        });
        stream.on('close', () => {
             console.log('[TRPC Router - bufferGrpcStream] gRPC stream closed.');
             // Resolve with existing chunks if stream closes prematurely but we have data
             if (chunks.length > 0 && !stream.readableEnded) {
                 console.warn('[TRPC Router - bufferGrpcStream] gRPC stream closed prematurely, returning buffered chunks.');
                 resolve(Buffer.concat(chunks));
             } else if (chunks.length === 0 && !stream.readableEnded) {
                 // If it closes before 'end' and without data, it's likely an error upstream or connection issue
                 reject(new TRPCError({
                     code: 'INTERNAL_SERVER_ERROR',
                     message: 'TTS service stream closed unexpectedly without sending data.',
                 }));
             }
             // If closed *after* 'end', resolve would have already happened.
        });
    });
}


export const router = t.router({
    /**
     * Fetches the complete MP3 audio for given text from the gRPC TTS service.
     * The server buffers the stream and returns the full audio as Base64.
     */
    getAudioForText: t.procedure
        .input(z.object({ text: z.string().min(1) }))
        .output(z.object({
            audioBase64: z.string(), // Base64 encoded MP3 data
            mimeType: z.string(),    // e.g., 'audio/mpeg'
        }))
        .query(async ({ input }) => {
            console.log(`[TRPC Router] Received getAudioForText request for text: "${input.text.substring(0, 50)}..."`);
            const grpcStream = synthesizeSpeechGrpc(input.text);

            if (!grpcStream) {
                console.error('[TRPC Router] Failed to initiate gRPC stream.');
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Could not connect to TTS service or create stream.',
                });
            }

            try {
                const audioBuffer = await bufferGrpcStream(grpcStream);
                console.log(`[TRPC Router] Audio buffered successfully. Size: ${audioBuffer.length} bytes.`);

                if (audioBuffer.length === 0) {
                     console.warn('[TRPC Router] Buffered audio is empty. TTS might have failed silently.');
                      throw new TRPCError({
                          code: 'INTERNAL_SERVER_ERROR',
                          message: 'TTS service returned empty audio.',
                      });
                }

                const audioBase64 = audioBuffer.toString('base64');
                return {
                    audioBase64: audioBase64,
                    mimeType: 'audio/mpeg', // Assuming MP3 as per ttsGrpcClient
                };
            } catch (error) {
                console.error('[TRPC Router] Error processing gRPC stream:', error);
                // Ensure TRPCError is thrown
                if (error instanceof TRPCError) {
                    throw error;
                }
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Failed to process audio stream.',
                    cause: error,
                });
            }
        }),

    /**
     * Fetches the next batch of review cards data directly.
     * Used for client-side pre-fetching.
     */
    getNextReviewCardsClient: t.procedure
        .input(z.object({ count: z.number().optional() }).optional()) // Allow optional count input
        .query(async ({ input }) => {
        const cardCount = input?.count ?? DEFAULT_CARD_FETCH_COUNT;
        // Directly call the updated gRPC adapter function
        return getNextReviewCards(cardCount);
        }),

});

export type Router = typeof router;
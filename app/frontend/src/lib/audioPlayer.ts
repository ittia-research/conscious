// src/lib/audioPlayer.ts
import { writable, get } from 'svelte/store';
import { trpc } from '$lib/trpc/client';
import { browser } from '$app/environment';
import type { AudioQueryResult } from '$lib/trpc/client';

// --- Types and State ---
type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'finished' | 'error' | 'unsupported';

export interface AudioStatus {
	state: AudioState;
	errorMessage?: string;
	currentText?: string;
}

const initialAudioState: AudioStatus = { state: 'idle' };
export const audioPlayerStatus = writable<AudioStatus>(initialAudioState);

// --- Internal Variables ---
let audioCtx: AudioContext | null = null;
let audioElement: HTMLAudioElement | null = null;
let currentObjectURL: string | null = null;
let currentTextLoaded: string | null = null; // Text whose audio is in the element/ObjectURL
let playRequestActiveForText: string | null = null; // Guard for concurrent loadAndPlay calls

// --- Caches ---
// Cache for pending fetch *Promises*
const pendingAudioFetches = new Map<string, Promise<AudioQueryResult>>();
// **NEW**: Cache for successfully fetched *Audio Data* (results)
const audioDataCache = new Map<string, AudioQueryResult>(); // Key: text, Value: { audioBase64, mimeType }

// --- Internal Functions (getAudioContext, base64ToUint8Array, cleanupAudioSource remain the same) ---

function getAudioContext(): AudioContext | null {
	// ... (no changes from previous revision) ...
	if (!browser) return null;
	if (!audioCtx) {
		try {
			audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
			if (audioCtx.state === 'suspended') {
				console.warn('[AudioPlayer] AudioContext suspended. User interaction likely needed.');
			}
		} catch (e) {
			console.error('[AudioPlayer] Web Audio API not supported:', e);
			audioPlayerStatus.set({ state: 'unsupported', errorMessage: 'Web Audio API not supported.' });
			return null;
		}
	}
	if (audioCtx.state === 'suspended') {
		audioCtx.resume().catch((err) => console.warn('[AudioPlayer] Failed to resume AudioContext automatically:', err));
	}
	return audioCtx;
}

function base64ToUint8Array(base64: string): Uint8Array {
    // ... (no changes from previous revision) ...
    if (!browser) throw new Error('Cannot decode Base64 outside browser.');
	try {
		const binaryString = window.atob(base64);
		const len = binaryString.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
		return bytes;
	} catch (error) {
		console.error('[AudioPlayer] Error decoding Base64 string:', error);
		throw new Error('Failed to decode audio data.');
	}
}

function cleanupAudioSource() {
    // ... (no changes from previous revision) ...
	if (!browser) return;
	if (audioElement && !audioElement.paused) {
		audioElement.pause();
	}
	if (audioElement) {
		const currentSrc = audioElement.getAttribute('src');
		if (currentSrc && currentSrc.startsWith('blob:')) {
            // console.debug('[AudioPlayer] Cleaning up audio source (removing blob src).');
			audioElement.removeAttribute('src');
			audioElement.load();
		}
	}
	if (currentObjectURL) {
		URL.revokeObjectURL(currentObjectURL);
		currentObjectURL = null;
	}
    currentTextLoaded = null;
}

// --- Exported Functions ---

// setAudioElement remains the same as the previous revision
export function setAudioElement(element: HTMLAudioElement | null) {
	// ... (no changes from previous revision) ...
	if (!browser) return;
	if (audioElement && audioElement !== element) {
        // console.debug('[AudioPlayer] Detaching listeners from old audio element.');
		audioElement.onplay = null;
		audioElement.onpause = null;
		audioElement.onended = null;
		audioElement.onerror = null;
        audioElement.onwaiting = null;
		audioElement.oncanplay = null;
        cleanupAudioSource();
	}
	audioElement = element;
	if (audioElement) {
		// console.log('[AudioPlayer] Audio element set.');
		audioElement.volume = 1.0;
		audioElement.onplay = () => { /* ... */ };
		audioElement.onpause = () => { /* ... */ };
		audioElement.onended = () => { /* ... */ };
		audioElement.onerror = (e) => { /* ... */ };
        audioElement.onwaiting = () => { /* ... */ };
		audioElement.oncanplay = () => { /* ... */ };
	} else {
		// console.log('[AudioPlayer] Audio element unset.');
		stopAudio();
	}
}


/**
 * Initiates fetching audio if not already cached or pending. Caches the result.
 */
export function initiateAudioFetchIfNeeded(text: string): void {
	if (!browser || !text || text.trim() === '' || !trpc) return;

	// 1. Check Data Cache first
	if (audioDataCache.has(text)) {
        // console.debug(`[AudioPlayer PreFetch] Data already in cache for: "${text.substring(0, 30)}..."`);
        return;
    }

	// 2. Check Pending Promises
	if (pendingAudioFetches.has(text)) {
		// console.debug(`[AudioPlayer PreFetch] Fetch already pending for: "${text.substring(0, 30)}..."`);
		return;
	}

	console.log(`[AudioPlayer PreFetch] Initiating background fetch for: "${text.substring(0, 30)}..."`);
	const fetchPromise = trpc().getAudioForText.query({ text });

	// Store the promise
	pendingAudioFetches.set(text, fetchPromise);

	// Process the result when the promise settles
	fetchPromise
		.then(result => {
			if (result?.audioBase64) {
                console.debug(`[AudioPlayer PreFetch] SUCCESS, caching data for: "${text.substring(0, 30)}..."`);
                // **CACHE THE RESULT DATA**
                audioDataCache.set(text, result);
            } else {
                 console.warn(`[AudioPlayer PreFetch] SUCCESS but no audio data received for: "${text.substring(0, 30)}..."`);
            }
		})
		.catch(err => {
			console.warn(`[AudioPlayer PreFetch] FAILED for: "${text.substring(0, 30)}..."`, err);
            // Optional: remove from data cache if it was added optimistically elsewhere? Not needed here.
		})
		.finally(() => {
            // Always remove the *promise* from the pending map once settled.
			pendingAudioFetches.delete(text);
			// console.debug(`[AudioPlayer PreFetch] Removed pending fetch entry for: "${text.substring(0, 30)}..."`);
		});
}

/**
 * Loads audio from cache or fetches, then decodes and plays.
 */
export async function loadAndPlayAudio(text: string) {
	if (!browser || !audioElement || !text || text.trim() === '' || !trpc) {
        // console.warn('[AudioPlayer Play] Preconditions not met.');
        return;
    }

	// console.log(`[AudioPlayer Play] Request load/play: "${text.substring(0, 30)}..."`);

    // Comment out to allow re-play
	// if (playRequestActiveForText === text) {
	// 	console.warn(`[AudioPlayer Play] Request already active. Ignoring.`);
	// 	return;
	// }

	// --- Ensure AudioContext ---
	if (!getAudioContext()) { /* ... error handling ... */ return; }

	const status = get(audioPlayerStatus);
    const previousText = status.currentText;

	// --- Stop/Cleanup ---
    if (status.state !== 'idle' && status.state !== 'finished' && previousText !== text) {
        // console.log(`[AudioPlayer Play] Stopping previous audio before loading new.`);
        stopAudio();
    }

	// --- Set Guard & Loading State ---
    playRequestActiveForText = text;
    audioPlayerStatus.set({ state: 'loading', currentText: text });

    let audioResult: AudioQueryResult | null = null;
    let fetchSource: 'cache' | 'pending' | 'new' = 'new'; // For debugging

	try {
        // --- Step 1: Check Data Cache ---
        if (audioDataCache.has(text)) {
            audioResult = audioDataCache.get(text)!;
            fetchSource = 'cache';
            console.debug(`[AudioPlayer Play] Using cached data for: "${text.substring(0, 30)}..."`);
        } else {
            // --- Step 2: Check Pending Fetch ---
            let audioPromise: Promise<AudioQueryResult>;
            if (pendingAudioFetches.has(text)) {
                fetchSource = 'pending';
                 console.debug(`[AudioPlayer Play] Using pending promise for: "${text.substring(0, 30)}..."`);
                audioPromise = pendingAudioFetches.get(text)!;
                // Wait for it and cache the result
                audioResult = await audioPromise; // Let potential errors propagate
                if (audioResult?.audioBase64) {
                    audioDataCache.set(text, audioResult); // Cache on successful await
                }
            } else {
                // --- Step 3: Initiate New Fetch ---
                fetchSource = 'new';
                console.log(`[AudioPlayer Play] Fetching new audio for: "${text.substring(0, 30)}..." (Cache/Pending Miss)`);
                audioPromise = trpc().getAudioForText.query({ text });
                // Store promise and add cleanup *immediately* in case of concurrent calls
                pendingAudioFetches.set(text, audioPromise);
                audioPromise.finally(() => { pendingAudioFetches.delete(text); });

                // Await the result
                audioResult = await audioPromise; // Let potential errors propagate
                if (audioResult?.audioBase64) {
                     console.debug(`[AudioPlayer Play] New fetch success, caching data for: "${text.substring(0, 30)}..."`);
                    audioDataCache.set(text, audioResult); // Cache on successful await
                } else {
                    console.warn(`[AudioPlayer Play] New fetch success but no audio data received.`);
                }
            }
        }

        // --- Check if we got valid data ---
        if (!audioResult?.audioBase64) {
            throw new Error(`No audio data obtained (${fetchSource}) for "${text.substring(0, 30)}..."`);
        }

		// --- Prepare for new audio ---
        cleanupAudioSource(); // Clean previous source *before* loading new
        currentTextLoaded = text; // Mark text *after* cleanup

		// --- Check Context after await/cache check ---
		const currentStatus = get(audioPlayerStatus);
		if (!audioElement || currentStatus.currentText !== text || currentStatus.state !== 'loading') {
			console.warn(`[AudioPlayer Play] Context changed (${currentStatus.state}/${currentStatus.currentText}) during fetch/processing. Aborting playback.`);
            if (playRequestActiveForText === text) playRequestActiveForText = null;
			return;
		}

        // --- Decode and Load ---
        const { audioBase64, mimeType } = audioResult;
		const audioBytes = base64ToUint8Array(audioBase64);
		const blob = new Blob([audioBytes], { type: mimeType });
		currentObjectURL = URL.createObjectURL(blob);

		// console.debug('[AudioPlayer Play] Setting src and loading...');
		audioElement.src = currentObjectURL;
		audioElement.load();

		// --- Play ---
		// console.log(`[AudioPlayer Play] Attempting to play (${fetchSource})...`);
		await audioElement.play();
		// console.debug('[AudioPlayer Play] Play command initiated.');
        // onplay handler sets 'playing' state and clears guard

	} catch (error: any) {
		console.error(`[AudioPlayer Play] Error during load/play (${fetchSource}):`, error);
        if (playRequestActiveForText === text) playRequestActiveForText = null; // Clear guard on error
		let message = error instanceof Error ? error.message : 'Failed to load or play audio.';
        const statusBeforeError = get(audioPlayerStatus);
        const textOnError = currentTextLoaded ?? text; // Use intended text if load failed early
        cleanupAudioSource(); // Clean up potentially failed source

        if(statusBeforeError.currentText === textOnError && statusBeforeError.state === 'loading') {
             if (error.name === 'NotAllowedError') { /* ... handle autoplay ... */ }
             else { audioPlayerStatus.set({ state: 'error', errorMessage: message, currentText: textOnError }); }
        } else { /* ... log warning ... */ }
	}
}

/**
 * Stops audio, cleans up, resets state. Also clears caches (optional).
 */
export function stopAudio() {
	if (!browser) return;
	// console.log('[AudioPlayer] Stop requested.');

    const textBeingLoaded = playRequestActiveForText;
    if (textBeingLoaded) playRequestActiveForText = null; // Clear guard

    const textThatWasLoaded = currentTextLoaded;
	cleanupAudioSource(); // Handles pause, src removal, object URL revoke, clears currentTextLoaded

	const currentState = get(audioPlayerStatus).state;
	if (currentState !== 'idle' && currentState !== 'finished') {
		audioPlayerStatus.set({ state: 'idle', errorMessage: undefined, currentText: undefined });
	} else {
        if(get(audioPlayerStatus).currentText !== undefined){
			audioPlayerStatus.update(s => ({...s, currentText: undefined}));
        }
	}

    // --- Optional: Cache Clearing ---
    // Decide if stopAudio should clear the data cache. Generally, probably not,
    // unless memory is a huge concern or you want a fresh start.
    // audioDataCache.clear();
    // pendingAudioFetches.clear(); // Might cancel ongoing fetches if AbortController was used
}

// Add a function to explicitly clear the audio data cache if needed (e.g., on logout)
export function clearAudioCache() {
    if (!browser) return;
    console.log('[AudioPlayer] Clearing audio data cache.');
    audioDataCache.clear();
    // Optionally clear pending fetches map too, though they manage themselves
    // pendingAudioFetches.clear();
}
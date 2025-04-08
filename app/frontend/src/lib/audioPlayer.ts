// src/lib/audioPlayer.ts
import { trpc } from '$lib/trpc/client';
import type { AudioStreamOutput } from '$lib/trpc/client';
import { writable, get } from 'svelte/store';
import type { Subscription } from '@trpc/client';
import { isAudioGloballyEnabled } from '$lib/stores/audioSettings';

// --- Configuration & State (remain the same) ---
const TARGET_SAMPLE_RATE = 16000;
const TARGET_NUM_CHANNELS = 1;
const PREFERRED_AUDIO_MIME_TYPE = 'audio/webm; codecs=opus';
const FALLBACK_AUDIO_MIME_TYPE = 'audio/webm; codecs=vorbis';
let selectedAudioMimeType: string | null = null;

type AudioStatus = 'idle' | 'initializing' | 'buffering' | 'playing' | 'paused' | 'error' | 'finished' | 'unsupported';
interface AudioPlayerState {
    state: AudioStatus;
    errorMessage?: string;
}
export const audioPlayerStatus = writable<AudioPlayerState>({ state: 'idle' });

// --- MSE & Audio Element Variables (remain the same) ---
let mediaSource: MediaSource | null = null;
let sourceBuffer: SourceBuffer | null = null;
let audioPlayerElement: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let currentTrpcSubscription: Subscription<AudioStreamOutput, unknown> | null = null;
let chunkQueue: ArrayBuffer[] = [];
let isAppending = false;
let isStreamEnded = false;

// --- Determine Supported MIME Type (remains the same) ---
function determineSupportedMimeType(): string | null {
    // ... (no changes) ...
     if (typeof window !== 'undefined' && window.MediaSource) {
        if (MediaSource.isTypeSupported(PREFERRED_AUDIO_MIME_TYPE)) {
            console.log(`[AudioPlayer] Using preferred MIME type: ${PREFERRED_AUDIO_MIME_TYPE}`);
            return PREFERRED_AUDIO_MIME_TYPE;
        }
        console.warn(`[AudioPlayer] Preferred MIME type ${PREFERRED_AUDIO_MIME_TYPE} not supported.`);
        if (FALLBACK_AUDIO_MIME_TYPE && MediaSource.isTypeSupported(FALLBACK_AUDIO_MIME_TYPE)) {
            console.log(`[AudioPlayer] Using fallback MIME type: ${FALLBACK_AUDIO_MIME_TYPE}`);
            return FALLBACK_AUDIO_MIME_TYPE;
        }
        console.error(`[AudioPlayer] No supported WebM audio MIME type found.`);
        return null;
    }
    return null;
}


// --- Core MSE Functions ---

function initializeMediaSource(): boolean {
    if (!audioPlayerElement) { /* ... (error handling) ... */ return false; }
    if (!selectedAudioMimeType) { selectedAudioMimeType = determineSupportedMimeType(); }
    if (!selectedAudioMimeType) { /* ... (error handling for unsupported) ... */ return false; }

    console.log('[AudioPlayer MSE] Initializing MediaSource...');
    cleanupMediaSource(); // Clean previous state

    mediaSource = new MediaSource();
    objectUrl = URL.createObjectURL(mediaSource);

    isStreamEnded = false;
    chunkQueue = [];
    isAppending = false;

    // Add listeners *before* setting src
    mediaSource.addEventListener('sourceopen', handleSourceOpen);
    mediaSource.addEventListener('sourceended', handleSourceEnded);
    mediaSource.addEventListener('sourceclose', handleSourceClose);

    // Set src to trigger sourceopen
    audioPlayerElement.src = objectUrl;
    // audioPlayerElement.load(); // Implicit

    console.log('[AudioPlayer MSE] MediaSource attaching...');
    audioPlayerStatus.set({ state: 'initializing' }); // Set state: Initializing
    return true;
}

function handleSourceOpen() {
    if (!mediaSource || mediaSource.readyState !== 'open' || !selectedAudioMimeType) {
         console.warn('[AudioPlayer MSE] handleSourceOpen called in invalid state.');
         // Avoid revoking URL if sourceopen didn't fire correctly? Or revoke always in cleanup?
         // Let cleanup handle URL revocation robustness.
        return;
    }
    console.log('[AudioPlayer MSE] Source open.');

    // Revoke URL now that it's attached
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        console.log('[AudioPlayer MSE] Object URL revoked.');
    }

    try {
        console.log(`[AudioPlayer MSE] Adding SourceBuffer with type: ${selectedAudioMimeType}`);
        sourceBuffer = mediaSource.addSourceBuffer(selectedAudioMimeType);
        sourceBuffer.mode = 'sequence';

        sourceBuffer.addEventListener('updateend', handleBufferUpdateEnd);
        sourceBuffer.addEventListener('error', handleBufferError);
        sourceBuffer.addEventListener('abort', handleBufferAbort);

        console.log('[AudioPlayer MSE] SourceBuffer created.');
        audioPlayerStatus.set({ state: 'buffering' }); // Set state: Buffering (ready for data)

        // ** CRITICAL CHANGE: Attempt to play *here* **
        // Now that the source buffer is ready, try starting playback.
        if (audioPlayerElement) {
            console.log('[AudioPlayer MSE] Attempting playback after source open...');
            audioPlayerElement.play().then(() => {
                console.log('[AudioPlayer MSE] Playback started successfully (or resumed).');
                // State might already be 'playing' due to event listener, or update here if needed
                // audioPlayerStatus.update(s => s.state === 'buffering' ? { state: 'playing' } : s);
            }).catch(err => {
                console.warn("[AudioPlayer MSE] Autoplay attempt failed after source open:", err.message);
                // If play fails (e.g., autoplay blocked), set state to paused
                 audioPlayerStatus.update(s => (s.state === 'buffering' || s.state === 'playing') ? { state: 'paused', errorMessage: "Playback paused (autoplay blocked?)." } : s);
            });
        } else {
             console.warn('[AudioPlayer MSE] Audio element missing when trying to play after source open.');
        }


        // Append any chunks that arrived *before* the source was open
        appendNextChunkFromQueue();

    } catch (error) {
        console.error('[AudioPlayer MSE] Error adding SourceBuffer:', error);
        // ... (error handling as before, set state to 'error' or 'unsupported') ...
         let errorMessage = `Failed to create audio buffer.`;
         if (error instanceof Error) { errorMessage += ` Type: ${error.name}, Message: ${error.message}`; }
         if (error instanceof DOMException && (error.name === 'NotSupportedError' || error.name === 'TypeError')) {
            errorMessage += ` (Likely unsupported MIME type: ${selectedAudioMimeType})`;
            audioPlayerStatus.set({ state: 'unsupported', errorMessage });
         } else {
            audioPlayerStatus.set({ state: 'error', errorMessage });
         }
        cleanupMediaSource();
    }
}

// handleSourceEnded, handleSourceClose (remain the same)
function handleSourceEnded() { console.log('[AudioPlayer MSE] Source ended.'); audioPlayerStatus.update(s => (!['error', 'idle', 'unsupported'].includes(s.state)) ? { state: 'finished' } : s); }
function handleSourceClose() { console.log('[AudioPlayer MSE] Source closed.'); audioPlayerStatus.update(s => (!['error', 'idle', 'finished', 'unsupported'].includes(s.state)) ? { state: 'idle' } : s); }

// handleBufferUpdateEnd (Add logging)
function handleBufferUpdateEnd() {
    isAppending = false;
    // console.debug('[AudioPlayer MSE] Buffer update end.'); // Optional: Verbose log
    appendNextChunkFromQueue(); // Try appending next queued chunk
    checkAndFinalizeStream();   // Check if stream can be ended
}

// handleBufferError (Add logging)
function handleBufferError(ev: Event) {
    console.error('[AudioPlayer MSE] SourceBuffer error:', ev, sourceBuffer?.error); // Log buffer's error object
    audioPlayerStatus.set({ state: 'error', errorMessage: 'Audio buffering error.' });
    cleanupMediaSource();
}
// handleBufferAbort (remains the same)
function handleBufferAbort(ev: Event) { console.warn('[AudioPlayer MSE] SourceBuffer abort:', ev); /* ... */ }


// --- Audio Element Event Handlers ---
// (Add logging and ensure state updates are correct)

function handleAudioPlay() {
    console.log('[AudioPlayer Elem] Event: play');
    // Don't force playing state here, wait for 'playing' event
}

function handleAudioPlaying() {
    console.log('[AudioPlayer Elem] Event: playing (actual playback start/resume)');
    audioPlayerStatus.update(s => (s.state !== 'playing') ? { state: 'playing' } : s ); // Update if not already playing
}

function handleAudioPause() {
    console.log('[AudioPlayer Elem] Event: pause');
    // Only set paused state if the pause wasn't triggered by us stopping (e.g., check isStreamEnded?)
    // Or more simply, only transition from playing/buffering
    audioPlayerStatus.update(s => (['playing', 'buffering'].includes(s.state)) ? { state: 'paused' } : s );
}

function handleAudioEnded() {
    console.log('[AudioPlayer Elem] Event: ended (natural playback end)');
    audioPlayerStatus.set({ state: 'finished' });
}

function handleAudioError(event: Event) {
     const audioElement = event.target as HTMLAudioElement;
     const error = audioElement.error;
     console.error('[AudioPlayer Elem] Event: error:', error); // Log the MediaError object
     let message = 'Unknown audio playback error.';
     // ... (error code mapping remains the same) ...
      if (error) {
         switch (error.code) {
             case MediaError.MEDIA_ERR_ABORTED: message = 'Playback aborted.'; break;
             case MediaError.MEDIA_ERR_NETWORK: message = 'Network error during playback.'; break;
             case MediaError.MEDIA_ERR_DECODE: message = 'Audio decoding error (check format).'; break;
             case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: message = 'Audio source/format not supported.'; break;
             default: message = `Playback error (code ${error.code}).`;
         }
     }
     audioPlayerStatus.set({ state: 'error', errorMessage: message });
     cleanupMediaSource(); // Cleanup MSE on element error
}

function handleAudioWaiting() {
     console.log('[AudioPlayer Elem] Event: waiting (buffering)');
     audioPlayerStatus.update(s => (['playing', 'initializing'].includes(s.state)) ? { state: 'buffering' } : s);
}
function handleAudioStalled() { console.warn('[AudioPlayer Elem] Event: stalled'); /* Similar to waiting */ }


// --- Data Handling ---

function queueChunk(chunk: ArrayBuffer) {
    if (!chunk || chunk.byteLength === 0) {
        console.warn('[AudioPlayer MSE] Attempted to queue empty chunk.');
        return;
    }
    // console.debug(`[AudioPlayer MSE] Queuing chunk size: ${chunk.byteLength}`); // Optional: Verbose
    chunkQueue.push(chunk);
    // Attempt to append immediately *only if buffer is ready*
    if (sourceBuffer && !sourceBuffer.updating && !isAppending && mediaSource?.readyState === 'open') {
       appendNextChunkFromQueue();
    } else {
        // console.debug('[AudioPlayer MSE] Conditions not met for immediate append from queue.', { hasBuffer: !!sourceBuffer, updating: sourceBuffer?.updating, isAppending, msState: mediaSource?.readyState});
    }
}

function appendNextChunkFromQueue() {
    if (isAppending || chunkQueue.length === 0 || !sourceBuffer || sourceBuffer.updating || !mediaSource || mediaSource.readyState !== 'open') {
        // console.debug('[AudioPlayer MSE] Skipping append.', { isAppending, queue: chunkQueue.length, hasBuffer: !!sourceBuffer, updating: sourceBuffer?.updating, msState: mediaSource?.readyState });
        return; // Conditions not met
    }

    isAppending = true;
    const chunkToAppend = chunkQueue.shift()!;
    // console.debug(`[AudioPlayer MSE] Dequeued chunk size: ${chunkToAppend.byteLength}. Appending...`); // Optional: Verbose

    try {
        sourceBuffer.appendBuffer(chunkToAppend);
        // console.debug('[AudioPlayer MSE] appendBuffer called.'); // Optional: Verbose
        // 'updateend' will fire on completion
    } catch (error) {
        console.error('[AudioPlayer MSE] Error during appendBuffer:', error);
         isAppending = false; // Reset flag on error!
         if (error instanceof Error && error.name === 'QuotaExceededError') {
             console.warn('[AudioPlayer MSE] Buffer quota exceeded.');
             audioPlayerStatus.set({ state: 'error', errorMessage: 'Audio buffer full.' });
         } else {
             audioPlayerStatus.set({ state: 'error', errorMessage: `Failed to buffer audio data: ${error instanceof Error ? error.message : 'Unknown error'}` });
         }
        cleanupMediaSource(); // Cleanup on append error
    }
}

// signalEndOfStream, checkAndFinalizeStream (remain the same)
function signalEndOfStream() { console.log('[AudioPlayer MSE] SignalEndOfStream called.'); isStreamEnded = true; checkAndFinalizeStream(); }
function checkAndFinalizeStream() { /* ... (no changes) ... */ }


// --- Public Control Functions ---

// setAudioElement (Add listeners here, remove from initialize)
export function setAudioElement(element: HTMLAudioElement | null) {
     // Remove listeners from previous element if any
     if (audioPlayerElement) {
        audioPlayerElement.removeEventListener('play', handleAudioPlay);
        audioPlayerElement.removeEventListener('playing', handleAudioPlaying);
        audioPlayerElement.removeEventListener('pause', handleAudioPause);
        audioPlayerElement.removeEventListener('ended', handleAudioEnded);
        audioPlayerElement.removeEventListener('error', handleAudioError);
        audioPlayerElement.removeEventListener('waiting', handleAudioWaiting);
        audioPlayerElement.removeEventListener('stalled', handleAudioStalled);
     }

     if (element) {
          console.log('[AudioPlayer] Audio element set.');
          audioPlayerElement = element;
          audioPlayerElement.preload = 'auto';

          // Add listeners to the new element
          audioPlayerElement.addEventListener('play', handleAudioPlay);
          audioPlayerElement.addEventListener('playing', handleAudioPlaying);
          audioPlayerElement.addEventListener('pause', handleAudioPause);
          audioPlayerElement.addEventListener('ended', handleAudioEnded);
          audioPlayerElement.addEventListener('error', handleAudioError);
          audioPlayerElement.addEventListener('waiting', handleAudioWaiting);
          audioPlayerElement.addEventListener('stalled', handleAudioStalled);


          // Determine supported type lazily if needed
          if (!selectedAudioMimeType && typeof window !== 'undefined') {
               selectedAudioMimeType = determineSupportedMimeType();
               if (!selectedAudioMimeType) {
                    audioPlayerStatus.set({ state: 'unsupported', errorMessage: 'Streaming audio format (Opus/WebM) not supported.' });
               }
          }
     } else {
          console.log('[AudioPlayer] Audio element cleared.');
          const currentState = get(audioPlayerStatus).state;
          if (!['idle', 'finished', 'error', 'unsupported'].includes(currentState)) {
             stopAudio(); // Stop if active when element is removed
          }
          audioPlayerElement = null;
     }
}


// playTextWithTRPC (Remove play() call from onStarted)
export function playTextWithTRPC(text: string) {
    // ... (initial checks for enabled, text, element, mime type remain the same) ...
     if (!get(isAudioGloballyEnabled)) { /* ... */ return; }
     if (!text) { /* ... */ return; }
     if (!audioPlayerElement) { /* ... */ return; }
     if (!selectedAudioMimeType) { /* ... */ return; }

    console.log('[AudioPlayer] Requesting playback for:', text.substring(0,30));
    stopAudio(); // Clean slate

    if (!initializeMediaSource()) {
        console.error("[AudioPlayer] Failed to initialize MediaSource setup.");
        return; // Status already set
    }

    // If initializeMediaSource succeeded, state is 'initializing'
    // It will transition to 'buffering' in handleSourceOpen, which now attempts play()

    console.log(`[AudioPlayer] Subscribing to tRPC audioStream (Opus/WebM)...`);
    currentTrpcSubscription = trpc().audioStream.subscribe(
        { text },
        {
            onStarted() {
                console.log('[AudioPlayer tRPC] Subscription started.');
                // ** DO NOT CALL play() HERE ANYMORE **
                // Play is now attempted in handleSourceOpen
            },
            onData(base64OpusChunk: AudioStreamOutput) {
                // ... (decoding and queueChunk logic remains the same) ...
                 const currentState = get(audioPlayerStatus).state;
                 if (['error', 'unsupported', 'idle', 'finished'].includes(currentState)) { /* ... stopAudio ... */ return; }
                 try {
                    const byteString = atob(base64OpusChunk);
                    const byteArray = new Uint8Array(byteString.length);
                    for (let i = 0; i < byteString.length; i++) { byteArray[i] = byteString.charCodeAt(i); }
                    queueChunk(byteArray.buffer);
                 } catch (error) { /* ... error handling ... */ stopAudio(); }
            },
            onError(err) { // Remain the same
                 console.error('[AudioPlayer tRPC] Subscription error:', err);
                 if (get(audioPlayerStatus).state !== 'unsupported') { audioPlayerStatus.set({ state: 'error', errorMessage: err.message || 'Stream error.' }); }
                 stopAudio();
            },
            onComplete() { // Remain the same
                console.log('[AudioPlayer tRPC] Subscription completed.');
                 const currentState = get(audioPlayerStatus).state;
                 if (!['error', 'unsupported', 'idle', 'finished'].includes(currentState)) { signalEndOfStream(); }
                 else { console.warn(`[AudioPlayer tRPC] Completed, but player state is ${currentState}.`); }
            },
        }
    );
}

// stopAudio (Ensure listeners are removed here too)
export function stopAudio() {
    console.log('[AudioPlayer] Stop requested.');

    if (currentTrpcSubscription) {
        currentTrpcSubscription.unsubscribe();
        currentTrpcSubscription = null;
        console.log('[AudioPlayer] tRPC subscription stopped.');
    }

    // Pause and remove element listeners
    if (audioPlayerElement) {
        // Remove listeners added in setAudioElement
        audioPlayerElement.removeEventListener('play', handleAudioPlay);
        audioPlayerElement.removeEventListener('playing', handleAudioPlaying);
        audioPlayerElement.removeEventListener('pause', handleAudioPause);
        audioPlayerElement.removeEventListener('ended', handleAudioEnded);
        audioPlayerElement.removeEventListener('error', handleAudioError);
        audioPlayerElement.removeEventListener('waiting', handleAudioWaiting);
        audioPlayerElement.removeEventListener('stalled', handleAudioStalled);

        if (!audioPlayerElement.paused) {
            audioPlayerElement.pause();
            console.log('[AudioPlayer] Audio element paused.');
        }
    }

    cleanupMediaSource(); // Handles MSE/SourceBuffer cleanup

    chunkQueue = [];
    isAppending = false;
    isStreamEnded = false;

    const currentState = get(audioPlayerStatus).state;
    if (!['idle', 'error', 'unsupported', 'finished'].includes(currentState)) {
       audioPlayerStatus.set({ state: 'idle' });
       console.log('[AudioPlayer] State set to idle.');
    } else {
       console.log(`[AudioPlayer] Stop requested, retaining final state: ${currentState}`);
    }
}

// cleanupMediaSource (remains largely the same, ensure URL revoked)
function cleanupMediaSource() {
    console.log('[AudioPlayer MSE] Cleaning up MediaSource resources...');
    // ... (SourceBuffer cleanup: remove listeners, abort if updating) ...
     if (sourceBuffer) {
        sourceBuffer.removeEventListener('updateend', handleBufferUpdateEnd);
        sourceBuffer.removeEventListener('error', handleBufferError);
        sourceBuffer.removeEventListener('abort', handleBufferAbort);
        if (mediaSource && mediaSource.readyState === 'open' && sourceBuffer.updating) {
           try { console.log('[AudioPlayer MSE] Aborting active SourceBuffer op.'); sourceBuffer.abort(); }
           catch (e) { console.warn("[AudioPlayer MSE] Error aborting source buffer:", e); }
        }
        sourceBuffer = null;
    }

    // ... (MediaSource cleanup: remove listeners, endOfStream if open) ...
     if (mediaSource) {
        mediaSource.removeEventListener('sourceopen', handleSourceOpen);
        mediaSource.removeEventListener('sourceended', handleSourceEnded);
        mediaSource.removeEventListener('sourceclose', handleSourceClose);
        if (mediaSource.readyState === 'open') {
            try { console.log('[AudioPlayer MSE] Attempting endOfStream during cleanup.'); mediaSource.endOfStream(); }
            catch (e) { /* Ignore InvalidStateError */ if (!(e instanceof DOMException && e.name === 'InvalidStateError')) { console.warn("[AudioPlayer MSE] Error ending stream during cleanup:", e); } }
        }
        mediaSource = null;
    }


    // Detach from audio element and revoke URL
    if (audioPlayerElement && audioPlayerElement.src && audioPlayerElement.src.startsWith('blob:')) {
        console.log('[AudioPlayer MSE] Detaching MediaSource URL from src.');
        audioPlayerElement.removeAttribute('src');
        audioPlayerElement.load(); // Force release
    }
    if (objectUrl) {
        console.log('[AudioPlayer MSE] Revoking Object URL during cleanup.');
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
    }

    console.log('[AudioPlayer MSE] MediaSource cleanup finished.');
}
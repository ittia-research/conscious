<!-- src/routes/review/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import ReviewCard from '$lib/components/reviewCard.svelte';
	import type { ActionData } from './$types';
	import type { ReviewCardResponse } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
	import {
        playTextWithTRPC,
        stopAudio,
        setAudioElement,
        audioPlayerStatus
    } from '$lib/audioPlayer';
    import { isAudioGloballyEnabled } from '$lib/stores/audioSettings';
    // Assuming you have an icon component like this, adjust the path if needed
    import InformationCircle from '$lib/components/icons/InformationCircle.svelte';

	// --- Props ---
	export let data: { initialCard: ReviewCardResponse | null; loadError?: string };
	export let form: ActionData;

	// --- State ---
	let currentCard: ReviewCardResponse | null = null;
	let isComplete: boolean = false;
	let errorMessage: string | null = null;
	let isLoadError: boolean = false;
	let submitting: boolean = false;
    let showPermissionInfo: boolean = false; // State to control the permission tooltip/modal
    let justToggledAudioOn: boolean = false; // Helper to detect immediate pause after enabling

    // --- Audio Player State ---
    let audioStatus: ReturnType<typeof audioPlayerStatus['subscribe']> extends { $: infer T } ? T : never;
    const unsubscribeAudioStatus = audioPlayerStatus.subscribe(value => {
        const previousState = audioStatus?.state; // Capture previous state before update
        audioStatus = value;

        // Detect if audio paused *immediately* after being toggled on or after a card change while enabled
        if ($isAudioGloballyEnabled && value.state === 'paused' && (justToggledAudioOn || previousState === 'initializing' || previousState === 'buffering')) {
            // If it paused right after we expected it to start playing, show the info.
            showPermissionInfo = true;
            console.log('[Audio Status] Detected pause likely due to autoplay restrictions. Showing info.');
        } else if (!$isAudioGloballyEnabled || (value.state !== 'paused' && value.state !== 'error')) {
            // Hide info if toggle is off OR state is not paused/error (allow error state to persist info if needed)
            // We might want finer control here depending on the error type.
            if (showPermissionInfo && value.state !== 'paused') {
                 showPermissionInfo = false;
                 console.log('[Audio Status] Hiding permission info as state is now:', value.state);
            }
        }

        // Reset the toggle helper flag once the state is no longer paused or initializing
        if (value.state !== 'paused' && value.state !== 'initializing') {
            justToggledAudioOn = false;
        }

    });

    let audioRef: HTMLAudioElement;

	// --- Initialization & Cleanup ---
	onMount(() => {
        console.log('[Mount] Setting audio element.');
        setAudioElement(audioRef);

		if (data.loadError) {
            console.log('[Mount] Load error detected:', data.loadError);
			errorMessage = data.loadError; isLoadError = true; currentCard = null; isComplete = false;
		} else {
            console.log('[Mount] Initial card:', data.initialCard);
			currentCard = data.initialCard; isLoadError = false;
			if (!currentCard) {
				isComplete = true;
                console.log('[Mount] No initial card, review complete.');
			} else {
				isComplete = false;
                console.log('[Mount] Initial card set.');
                if ($isAudioGloballyEnabled && currentCard.text) {
                    console.log('[Mount] Attempting initial audio play.');
                    justToggledAudioOn = true; // Assume potential immediate pause
				    playTextWithTRPC(currentCard.text);
                } else {
                     console.log('[Mount] Initial audio play skipped (disabled or no text).');
                }
			}
		}
	});

	onDestroy(() => {
        console.log('[Destroy] Stopping audio and cleaning up.');
        stopAudio();
        setAudioElement(null); // Important for cleanup
        unsubscribeAudioStatus();
	});

	// --- Reactive Updates ---

	let previousCardId: number | string | null = currentCard?.thought_id ?? null; // Initialize with mounted card ID

	// Process form submission results
    $: {
		submitting = $page.form?.submitting ?? false;
		if (form && !submitting) {
            console.log('[Form Reaction] Processing form result:', form);
			stopAudio(); // Stop any ongoing audio first

			if (!isLoadError) { errorMessage = null; } // Clear previous non-load errors

			if (form.success) {
                const nextCard = form.nextCard ?? null;
                console.log('[Form Reaction] Success, next card:', nextCard);
                currentCard = nextCard;
                isComplete = !currentCard;
                isLoadError = false;
                errorMessage = null;
			} else if (form.message) {
                console.log('[Form Reaction] Error message:', form.message);
				errorMessage = form.message;
                isLoadError = false;
			}
		}
	}

    // Effect to handle audio playback based on card changes & toggle state
    $: {
        const activeCardId = currentCard?.thought_id ?? null;
        const cardHasChanged = activeCardId !== previousCardId;

        if (cardHasChanged) {
            console.log(`[Card Change Effect] Card changed from ${previousCardId} to ${activeCardId}`);
            previousCardId = activeCardId;

            if (currentCard && currentCard.text && $isAudioGloballyEnabled) {
                console.log('[Card Change Effect] Conditions met, calling playTextWithTRPC.');
                justToggledAudioOn = true; // Assume potential immediate pause after card change
                playTextWithTRPC(currentCard.text);
            } else if (currentCard) {
                 console.log('[Card Change Effect] Skipping audio play (disabled, no text, or card became null).');
                 if (!currentCard.text || !$isAudioGloballyEnabled) {
                    stopAudio();
                 }
            } else {
                console.log('[Card Change Effect] Card is null, stopping audio.');
                stopAudio();
            }
        }
    }

    // Effect to handle the global audio toggle
    $: {
        // This runs whenever $isAudioGloballyEnabled changes
        const isEnabled = $isAudioGloballyEnabled; // Capture current value
        console.log('[Toggle Effect] Audio global enabled state changed to:', isEnabled);

        if (!isEnabled) {
            if (['playing', 'buffering', 'paused', 'initializing'].includes(audioStatus.state)) {
                console.log('[Toggle Effect] Global audio toggle turned off, stopping audio.');
                stopAudio();
            }
            showPermissionInfo = false; // Ensure info is hidden when toggled off
            justToggledAudioOn = false;
        } else {
            // When toggled ON:
            // If there's a current card, try to play its audio.
            // We only set the flag here; the actual play happens if a card exists.
            justToggledAudioOn = true;
            // Check if we should play immediately if a card is already loaded
             if (currentCard && currentCard.text && (audioStatus.state === 'idle' || audioStatus.state === 'finished')) {
                console.log('[Toggle Effect] Global audio toggled ON with a card present, attempting play.');
                playTextWithTRPC(currentCard.text);
             } else if (audioStatus.state === 'paused' && !showPermissionInfo) {
                // If it was manually paused before, perhaps try resuming? Or let the user click play?
                // For now, we rely on card changes or initial load to trigger play.
                console.log('[Toggle Effect] Global audio toggled ON, state is paused but not showing permission info.');
             }
        }
    }

    // Clear permission info if audio starts playing successfully
    $: {
        if (audioStatus.state === 'playing' && showPermissionInfo) {
            console.log('[Reactive Effect] Audio started playing, hiding permission info.');
            showPermissionInfo = false;
        }
    }

</script>

<!-- Visually Hidden Audio Element -->
<audio bind:this={audioRef} style="display: none;"></audio>

<!-- Main container -->
<div class="container mx-auto p-4 max-w-2xl relative min-h-screen"> <!-- Added relative positioning and min height -->

    <!-- Audio Toggle & Info - Top Right -->
    <div class="absolute top-4 right-4 z-20 flex flex-col items-end space-y-1">
        <!-- Switch Row -->
        <div class="flex items-center space-x-2 p-1 bg-white dark:bg-gray-800 rounded-full shadow">
             <span class="text-sm font-medium text-gray-700 dark:text-gray-300 pl-2">Speak</span>
            <label for="audioToggle" class="relative inline-flex items-center cursor-pointer" title="Toggle automatic audio playback ({$isAudioGloballyEnabled ? 'On' : 'Off'})">
                <input
                    type="checkbox"
                    id="audioToggle"
                    class="sr-only peer" 
                    bind:checked={$isAudioGloballyEnabled}
                    aria-label="Enable audio playback for review cards"
                />
                <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-offset-1 peer-focus:ring-indigo-500 dark:peer-focus:ring-indigo-600 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-indigo-600"></div>
            </label>
        </div>

        <!-- Autoplay Permission Info Popup -->
        {#if showPermissionInfo}
             <div transition:fade={{ duration: 150 }} class="permission-info-popup bg-yellow-100 border border-yellow-300 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-100 text-yellow-800 px-3 py-2 rounded-md shadow-lg text-xs max-w-xs text-left flex items-start space-x-1.5" role="alert">
                  <div class="flex-shrink-0 pt-0.5">
                      <InformationCircle classValue="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <span>
                       Audio paused. To enable autoplay, please
                       <a href="https://support.google.com/chrome/answer/114662?hl=en&co=GENIE.Platform%3DDesktop#zippy=%2Callow-or-block-sound-for-a-specific-site" target="_blank" rel="noopener noreferrer" class="underline font-semibold hover:text-yellow-900 dark:hover:text-yellow-300">
                          allow sound/autoplay
                       </a>
                        for this site in your browser settings. Reloading the page might be needed after changing settings.
                  </span>
                  <!-- Optional Dismiss Button -->
                 <button
                     on:click={() => showPermissionInfo = false}
                     class="ml-auto flex-shrink-0 -mt-1 -mr-1 p-1 rounded-full text-yellow-700 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                     aria-label="Dismiss permission notice"
                 >
                      <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                 </button>
             </div>
        {/if}

         <!-- Unsupported Audio Info -->
         {#if audioStatus.state === 'unsupported'}
             <div transition:fade class="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 px-2 py-1 rounded shadow max-w-xs text-right">
                 (Audio streaming not supported by browser)
             </div>
         {/if}
    </div>


	<h1 class="text-2xl font-bold mb-4 text-center pt-16 md:pt-12">Flashcard Review</h1> <!-- Added more padding-top for space -->


	<!-- General Error Messages -->
	{#if errorMessage && !showPermissionInfo /* Don't show general error if permission info is shown */}
        <div transition:fade class="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200 px-4 py-3 rounded relative mb-4 shadow" role="alert">
           <strong class="font-bold">Error:</strong>
           <span class="block sm:inline ml-1"> {errorMessage}</span>
           {#if !isLoadError}
               <button
                   class="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-100"
                   on:click={() => { errorMessage = null; }}
                   aria-label="Close error message"
                >
                   <svg class="fill-current h-6 w-6" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
               </button>
           {/if}
       </div>
	{/if}

    <!-- Audio Status Indicator (Error) -->
	{#if $isAudioGloballyEnabled && audioStatus.state === 'error'}
        <div transition:fade class="audio-status-indicator mb-4 p-2 rounded text-sm text-center shadow-sm
            {audioStatus.state === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
             ['buffering', 'initializing'].includes(audioStatus.state) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' :
            '' }">
			<span>⚠️ Audio Error: {audioStatus.errorMessage || 'Could not play audio.'}</span>
			<button title="Clear error and stop audio" on:click={stopAudio} class="ml-2 text-xs underline hover:no-underline">(Clear)</button>
        </div>
    {/if}

	<!-- Content Display Area -->
    <div class="card-display-area mt-6"> <!-- Added margin-top -->
        {#if isLoadError}
             <p class="text-center text-gray-600 dark:text-gray-400 py-10">Could not load review session.</p>
        {:else if isComplete}
            <div transition:fade class="text-center py-10">
                <h2 class="text-xl font-semibold text-green-600 dark:text-green-400">All highlights reviewed!</h2>
                <p class="text-gray-600 dark:text-gray-400 mt-2">You've completed this session.</p>
            </div>
        {:else if currentCard}
            <!-- Key: Render ReviewCard only when we have a card and are not complete/load-error -->
            <ReviewCard card={currentCard} {submitting} />
        {:else if !submitting && !isLoadError}
             <!-- Loading state for initial load or between cards if form isn't submitting -->
             <div class="text-center text-gray-500 dark:text-gray-400 py-10 animate-pulse">Loading review card...</div>
         {:else}
            <!-- Fallback or explicit loading state during submission if needed,
                 though the fixed indicator might be sufficient. -->
        {/if}
    </div>

	<!-- Global Loading Indicator (During Form Submission) -->
	{#if submitting}
         <div class="fixed bottom-4 right-4 bg-gray-800 text-white text-sm py-2 px-4 rounded-lg shadow-lg flex items-center animate-pulse z-30"> <!-- Increased z-index -->
             <span class="animate-spin inline-block mr-2">
                 <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
             </span>
             Processing...
         </div>
	{/if}
</div>

<style>
	/* You can add global styles or component-specific overrides here if necessary */
</style>
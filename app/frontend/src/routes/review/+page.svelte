<!-- src/routes/review/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import type { ReviewCardResponse } from '$lib/types';
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		loadAndPlayAudio,
		stopAudio,
		setAudioElement,
		audioPlayerStatus,
		initiateAudioFetchIfNeeded,
		type AudioStatus
	} from '$lib/audioPlayer';
	import { isAudioGloballyEnabled } from '$lib/stores/audioSettings';
	import { trpc } from '$lib/trpc/client';
	import { browser } from '$app/environment';
	import { writable, derived, get } from 'svelte/store';

    import CloseIcon from '$lib/components/icons/CloseIcon.svelte';
    import InformationCircle from '$lib/components/icons/InformationCircle.svelte';

    import { projectName } from '$lib';

	// --- Props ---
	export let form: ActionData; // From server actions (POST requests)

	// --- Constants ---
	const CARD_CACHE_SIZE = 5; // How many cards to keep ready
	const REFILL_THRESHOLD = 3; // Fetch more when cache drops to this size
	const grades = [
		{ label: 'Again', value: 1, color: 'btn-error', textColor: 'text-error-content' },
		{ label: 'Hard', value: 2, color: 'btn-warning', textColor: 'text-warning-content' },
		{ label: 'Good', value: 3, color: 'btn-success', textColor: 'text-success-content' },
		{ label: 'Easy', value: 4, color: 'btn-info', textColor: 'text-info-content' }
	];

	// --- State Stores ---
	const cardCache = writable<ReviewCardResponse[]>([]);
	const isLoading = writable<boolean>(true); // Loading initial data client-side
	const isRefilling = writable<boolean>(false); // Loading more cards in background
	const isComplete = writable<boolean>(false); // Review session finished
	const errorMessage = writable<string | null>(null); // General error messages
	const isLoadError = writable<boolean>(false); // Fatal error loading initial data
	const submitting = writable<boolean>(false); // Tracks if *any* form action is in progress
	const showPermissionInfo = writable<boolean>(false); // Audio autoplay permission popup

	// --- Derived State ---
	const currentCard = derived(cardCache, ($cache) => $cache[0] ?? null);

	// --- Audio Player State ---
	let audioStatus: AudioStatus | undefined = undefined;
	let unsubscribeAudioStatus = () => {};
	let audioRef: HTMLAudioElement;

	// --- Fetch initial cards ---
	async function fetchInitialCards() {
		if (!browser) return;

		isLoading.set(true);
		isLoadError.set(false);
		errorMessage.set(null);
		cardCache.set([]);

		try {
			const initialCards = await fetchMoreCards(CARD_CACHE_SIZE);

			if (initialCards.length > 0) {
				// console.log(`[Mount] Successfully fetched ${initialCards.length} initial cards.`);
				// No need to check for duplicates on initial fetch
				cardCache.set(initialCards);
				prefetchAudioForCache(initialCards);
			} else {
				// console.log('[Mount] No initial cards available. Setting session complete.');
				isComplete.set(true);
			}
		} catch (error: any) {
			console.error('[Mount] CRITICAL: Failed to fetch initial cards:', error);
			errorMessage.set(error.message || 'Failed to load the review session.');
			isLoadError.set(true);
			cardCache.set([]);
		} finally {
			isLoading.set(false);
			 // console.log(`[Mount] Initial fetch finished. isLoading: false, isLoadError: ${get(isLoadError)}, isComplete: ${get(isComplete)}`);
			 // Final check: if still empty after loading finished, mark complete
			 if (get(cardCache).length === 0 && !get(isLoadError)) {
				 // console.log('[Mount] Final check confirms empty cache and no load error. Setting complete.');
				 isComplete.set(true);
			 }
		}
	}


	// --- Lifecycle Hooks (onMount, onDestroy) ---
	onMount(async () => {
        if (!browser) return;

		unsubscribeAudioStatus = audioPlayerStatus.subscribe((value) => {
			const previousState = audioStatus?.state;
			audioStatus = value;
			// Show permission info only if audio is enabled, was loading, paused unexpectedly,
			// and the error message suggests autoplay issues.
			if (
				get(isAudioGloballyEnabled) &&
				value.state === 'paused' &&
				previousState === 'loading' &&
				value.errorMessage?.match(/autoplay|allowed|interaction|gesture/i)
			) {
				showPermissionInfo.set(true);
				console.warn('[Audio Status] Detected pause likely due to autoplay restrictions.');
			} else if (value.state !== 'paused' && value.state !== 'error' && get(showPermissionInfo)) {
				// Hide permission info if state changes away from paused/error
				showPermissionInfo.set(false);
			}
		});

		setAudioElement(audioRef);

		await fetchInitialCards();
	});

	onDestroy(() => {
		if (browser) {
			// console.log('[Destroy] Cleaning up: Stopping audio, unsetting element, unsubscribing.');
			stopAudio();
			setAudioElement(null); // Important to prevent memory leaks
			unsubscribeAudioStatus();
		}
	});


	// --- Cache Management (fetchMoreCards, checkAndRefillCache) ---
	async function fetchMoreCards(count: number): Promise<ReviewCardResponse[]> {
		if (!browser || count <= 0) return [];
		// console.log(`[Cache] Attempting to fetch ${count} more card(s)...`);

		// Only set isRefilling if NOT in the initial loading phase
		if (!get(isLoading)) {
            isRefilling.set(true);
        }
		errorMessage.set(null); // Clear previous non-fatal errors on new fetch attempt

		try {
			const newCards = await trpc().getNextReviewCardsClient.query({ count });
			// console.log(`[Cache] Fetched ${newCards.length} card(s). IDs: ${newCards.map(c => c.thought_id).join(', ')}`);
			return newCards;
		} catch (error: any) {
			console.error('[Cache] Failed to fetch more cards:', error);
			// Avoid setting isLoadError for refill errors, keep it for initial load failure
            errorMessage.set(error.message || 'Failed to load next cards.');
			return []; // Return empty array on failure
		} finally {
			// Only set isRefilling to false if it was set to true (i.e., not initial load)
			if (!get(isLoading)) {
                isRefilling.set(false);
            }
		}
	}

	async function checkAndRefillCache() {
		if (!browser || get(isRefilling) || get(isComplete) || get(isLoadError) || get(isLoading)) {
            // console.debug(`[Cache] Refill skipped (isLoading: ${get(isLoading)}, isRefilling: ${get(isRefilling)}, isComplete: ${get(isComplete)}, isLoadError: ${get(isLoadError)})`);
            return;
        }

		const currentCacheSize = get(cardCache).length;
		if (currentCacheSize <= REFILL_THRESHOLD) {
			const needed = CARD_CACHE_SIZE // The comming newly fetched cards might contains all the cards in the current cache
			if (needed > 0) {
				// console.log(`[Cache] Refill needed. Current size: ${currentCacheSize}, Threshold: ${REFILL_THRESHOLD}. Fetching ${needed} card(s).`);
				const fetchedCards = await fetchMoreCards(needed); // Already handles isRefilling state

				if (fetchedCards.length > 0) {
					let uniqueNewCards: ReviewCardResponse[] = [];
					cardCache.update(cache => {
						// *** Avoid Duplication ***
						const existingIds = new Set(cache.map(c => c.thought_id));
						uniqueNewCards = fetchedCards.filter(newCard => !existingIds.has(newCard.thought_id));

						if (uniqueNewCards.length !== fetchedCards.length) {
							console.log(`[Cache] Filtered out ${fetchedCards.length - uniqueNewCards.length} duplicate card(s) from fetch result.`);
						}
						return [...cache, ...uniqueNewCards];
					});

					// Prefetch only for the unique cards actually added to the cache
					prefetchAudioForCache(uniqueNewCards);
                    // console.log(`[Cache] Refilled. New cache size: ${get(cardCache).length}`);
				} else if (get(cardCache).length === 0) {
					// console.log('[Cache] Fetch returned 0 cards and cache is now empty. Setting session complete.');
					isComplete.set(true);
                    // isRefilling is already handled by fetchMoreCards finally block
				}
                // If fetch returned 0 but cache still has items, do nothing extra here.
			}
		}

        // Final check
        if (get(cardCache).length === 0 && !get(isRefilling) && !get(isLoading) && !get(isLoadError)) {
             // console.log('[Cache] Final check: Cache is empty and not loading/refilling/error. Setting complete.');
             isComplete.set(true);
        }
	}

	// --- Audio Pre-fetching ---
    function prefetchAudioForCache(cardsToPrefetch: ReviewCardResponse[]) {
		if (!browser || !get(isAudioGloballyEnabled) || cardsToPrefetch.length === 0) return;
		// console.log(`[Audio Prefetch] Queueing audio prefetch for ${cardsToPrefetch.length} card(s).`);
		cardsToPrefetch.forEach(card => {
			if (card.text?.trim()) {
				initiateAudioFetchIfNeeded(card.text);
			}
		});
	}

	// --- Form Action Success Handling ---
	async function handleReviewActionSuccess() {
        if (!browser) return;
        const cardJustReviewed = get(currentCard); // Get the card *before* updating the store
        if (!cardJustReviewed) {
            console.warn('[Action Success] No current card found in store before update. Cannot process.');
            return;
        }
		// console.log(`[Action Success] Client handling success for Card ID: ${cardJustReviewed.thought_id}`);

        // Stop audio if it was playing for the card just reviewed
        if (audioStatus?.currentText === cardJustReviewed.text && ['playing', 'loading', 'paused'].includes(audioStatus.state)) {
            // console.log('[Action Success] Stopping audio for reviewed card.');
            stopAudio();
        }

        // Optimistically remove the reviewed card from the cache
		cardCache.update(cache => cache.slice(1)); // Removes the first element

		await tick(); // Wait for the UI to potentially update based on cache change

        // console.log(`[Action Success] Tick complete. New current card ID (from store): ${get(currentCard)?.thought_id ?? 'None'}`);

		// Trigger background refill check (don't wait for it)
		checkAndRefillCache();
        // console.log('[Action Success] Client-side update process finished.');
	}


	// --- Reactive Effects ---
    // Handle server action results (errors/messages) passed via the 'form' prop
	$: if (browser && form?.message) {
        // console.warn('[Form Reaction] Server action resulted in message:', form.message, 'Type:', form.type);
        if (form.type === 'failure') {
             errorMessage.set(form.message);
        } else if (form.type === 'success' && form.message) {
             // Optional: handle success messages if needed (e.g., toast)
             // console.log('[Form Reaction] Success message:', form.message);
        }
		// Clear the form prop data once processed to prevent re-triggering
		form = null;
	}

	// Manage audio playback based on current card and global setting changes
	let previousCardId: number | null = null;
	let previousAudioEnabledState: boolean | undefined = undefined;
	$: if (browser) {
		const activeCard = $currentCard;
		const activeCardId = activeCard?.thought_id ?? null;
		const audioIsEnabled = $isAudioGloballyEnabled;
		const currentAudioState = audioStatus?.state ?? 'idle';
        const activeCardText = activeCard?.text?.trim(); // Use trimmed text

		// --- Effect: Card Change ---
		if (activeCardId !== previousCardId) {
			// console.debug(`[Audio Effect] Card changed: ${previousCardId} -> ${activeCardId}`);
			previousCardId = activeCardId;

			if (activeCardText && audioIsEnabled) {
				// console.log(`[Audio Effect] New card ${activeCardId} has text and audio is ON. Playing.`);
				loadAndPlayAudio(activeCardText);
			} else if (['playing', 'loading', 'paused'].includes(currentAudioState)) {
				// Stop audio if new card is null, has no text, or audio is globally off
				// console.log(`[Audio Effect] New card null/no-text/audio-off OR card changed. Stopping current audio.`);
				stopAudio();
			}
		}
        // --- Effect: Audio Toggle Change ---
        else if (activeCardId !== null && audioIsEnabled !== previousAudioEnabledState) {
            // console.debug(`[Audio Effect] Audio toggle changed: ${previousAudioEnabledState} -> ${audioIsEnabled} while card ${activeCardId} is displayed.`);

            if (audioIsEnabled && activeCardText) {
                 if (!['playing', 'loading'].includes(currentAudioState)) {
                     // console.log(`[Audio Effect] Audio toggled ON. Playing audio for card ${activeCardId}.`);
                     loadAndPlayAudio(activeCardText);
                 }
            } else if (!audioIsEnabled) {
                if (['playing', 'loading', 'paused'].includes(currentAudioState)) {
                     // console.log(`[Audio Effect] Audio toggled OFF. Stopping audio.`);
                     stopAudio();
                 }
            }
        }

        // Update previous state for next check
        if (audioIsEnabled !== previousAudioEnabledState) {
            previousAudioEnabledState = audioIsEnabled;
        }
	}

	// Hide permission info automatically once audio starts playing
	$: if (browser && audioStatus?.state === 'playing' && $showPermissionInfo) {
		// console.log('[Reactive Effect] Audio has started playing, hiding permission info.');
		showPermissionInfo.set(false);
	}

</script>


<svelte:head>
	<title>Flashcard Review | {projectName}</title>
</svelte:head>


<!-- Hidden audio element controlled by audioPlayer utility -->
<audio bind:this={audioRef} style="display: none;"></audio>

<div class="container mx-auto px-4 py-4 md:py-2 max-w-3xl relative min-h-screen flex flex-col">

	<!-- Top Controls Area (Audio Toggle & Info Popups) -->
    <div class="absolute top-2 right-8 z-20 flex flex-col items-end space-y-2">
		<!-- Speak button -->
        <div class="flex items-center space-x-2 p-1 bg-white dark:bg-gray-800 rounded-full shadow">
            <span 
                class="text-sm font-medium text-gray-700 dark:text-gray-300 pl-2 cursor-pointer"
                on:click={() => {
                    // Play audio when the text area is clicked
                    if ($currentCard?.text?.trim()) {
                        loadAndPlayAudio($currentCard.text.trim());
                    }
                }}
                role="button"
                aria-label="Replay audio for this card"
                tabindex="0"
                on:keypress={(e) => { // TO-DO: Allow replay via keyboard (Enter/Space)
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault(); // Prevent default space scroll/enter actions
                        if ($currentCard?.text?.trim()) { loadAndPlayAudio($currentCard.text.trim()); }
                    }
                }}
            >Speak</span>
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
        {#if $showPermissionInfo}
             <div class="permission-info-popup bg-yellow-100 border border-yellow-300 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-100 text-yellow-800 px-3 py-2 rounded-md shadow-lg text-xs max-w-xs text-left flex items-start space-x-1.5" role="alert">
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
                  <!-- Dismiss Button -->
                 <button
                     on:click={() => {
                        showPermissionInfo.set(false);
                        console.log('Dismiss permission info clicked!');
                    }}
                     class="ml-auto flex-shrink-0 -mt-1 -mr-1 p-1 rounded-full text-yellow-700 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                     aria-label="Dismiss permission notice"
                 >
                    <CloseIcon classValue="w-3 h-3" />
                 </button>
             </div>
        {/if}
	</div>

	<!-- General Error Messages -->
	{#if errorMessage && !showPermissionInfo /* Don't show general error if permission info is shown */}
        <div transition:fade class="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200 px-4 py-3 rounded relative mb-4 shadow" role="alert">
           <strong class="font-bold">Error:</strong>
           <span class="block sm:inline ml-1"> {errorMessage}</span>
           {#if !isLoadError}
               <button
                    class="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-500 dark:text-red-300 hover:text-red-700 dark:hover:text-red-100"
                    on:click={() => { errorMessage.set(null); }}
                    aria-label="Close error message"
                >
                    <CloseIcon classValue="fill-current h-6 w-6" />
               </button>
           {/if}
       </div>
	{/if}

	<!-- Main Content Display Area -->
	<div class="card-display-area min-h-[350px] sm:min-h-[300px] flex-grow flex flex-col items-center justify-start pt-2 sm:pt-4">
		{#if $isLoading}
			<!-- Loading Initial Session State -->
			<div class="text-center text-base-content/60 py-10">
                <span class="loading loading-dots loading-lg"></span>
                <p class="mt-2">Loading review session...</p>
            </div>
		{:else if $isLoadError}
			<!-- Fatal Load Error State -->
            <div class="alert alert-error shadow-lg max-w-xl" role="alert">
                <p class="text-center text-gray-600 dark:text-gray-400 py-10">Could not load flashcard session.</p>
            </div>
		{:else if $isComplete}
			<div transition:fade={{ duration: 300 }} class="text-center py-10 flex flex-col items-center">
                <h2 class="text-xl font-semibold text-green-600 dark:text-green-400">All highlights reviewed!</h2>
                <p class="text-gray-600 dark:text-gray-400 mt-2">You've completed this session.</p>
			</div>
		{:else if $currentCard}
			<!-- Display Current Card and Action Buttons -->
            {#key $currentCard.thought_id}
                 <form
                    method="POST"
                    use:enhance={() => {
                        submitting.set(true);
                        errorMessage.set(null);
                        return async ({ result, update }) => {
                            submitting.set(false);
                            if (result.type === 'success' || (result.type === 'redirect' && result.status === 303)) {
                                await handleReviewActionSuccess();
                            } else if (result.type === 'failure') {
                                console.error('[Enhance] Action Failure:', (result.data as any)?.message);
                                errorMessage.set((result.data as { message?: string })?.message ?? 'Failed to process review.');
                            } else if (result.type === 'error') {
                                 console.error('[Enhance] Action Error:', result.error?.message);
                                errorMessage.set(result.error?.message ?? 'Unexpected error processing review.');
                            } else {
                                 console.warn("[Enhance] Unhandled result type:", result.type);
                                 if (result.type !== 'failure' && result.type !== 'error') {
                                     await handleReviewActionSuccess(); // Fallback assumption
                                 }
                            }
                            await update({ reset: false });
                        };
                    }}
                    class="w-full max-w-xl"
                 >
                     <input type="hidden" name="thoughtId" value={$currentCard.thought_id} />

                     <!-- *** Card Structure *** -->
                     <div class="card w-full
                                bg-white/80 dark:bg-gray-900/70   /* Slightly less transparent background */
                                backdrop-blur-sm                  /* Optional: still keep or remove based on performance */
                                shadow-lg
                                rounded-xl
                                overflow-hidden                   /* Good practice with rounded corners and backdrop-blur */
                     ">
                        <div class="card-body p-5 sm:p-6 flex flex-col">
                            <!-- Text Area -->
                            <div class="mb-6 px-4 pb-1 rounded-md bg-white/95 dark:bg-gray-800/90" >
                                <p class="text-lg whitespace-pre-wrap text-gray-900 dark:text-gray-100 text-justify">{$currentCard.text}</p>
                            </div>

                            <!-- Grade Buttons -->
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-2">
                                {#each grades as gradeInfo}
                                    <button
                                        type="submit"
                                        formaction="?/submitGrade"
                                        name="grade"
                                        value={gradeInfo.value}
                                        class="btn {gradeInfo.color} {gradeInfo.textColor} font-semibold transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed flex-grow py-3"
                                        disabled={$submitting}
                                    >
                                        {#if $submitting} <span class="loading loading-spinner loading-xs mr-1"></span> {/if}
                                        {gradeInfo.label}
                                    </button>
                                {/each}
                            </div>

                            <!-- Discard Button Area (Positioned bottom-right) -->
                            <div class="mt-auto flex justify-end pt-2">
                                <button
                                    type="submit"
                                    formaction="?/discardCard"
                                    class="btn btn-ghost btn-sm text-base-content/70 hover:bg-error/10 hover:text-error dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={$submitting}
                                    title="Remove this card from future reviews"
                                >
                                    {#if $submitting} <span class="loading loading-spinner loading-xs mr-1"></span> {/if}
                                    Discard
                                </button>
                            </div>
                        </div>
                    </div>
                 </form>
             {/key}
		{:else if !$submitting && ($isRefilling || get(cardCache).length === 0)}
            <!-- Loading next card state -->
			<div class="text-center text-base-content/60 py-10">
                 <span class="loading loading-dots loading-lg"></span>
                 <p class="mt-2">Loading next card...</p>
             </div>
        {:else}
			<!-- Fallback state -->
             <div class="text-center text-base-content/60 py-10">
                 <span class="loading loading-ring loading-lg"></span>
                 <p class="mt-2">Processing...</p>
             </div>
        {/if}
	</div>
</div>

<style>
	/* Minimal styles - relying mostly on Tailwind utilities */
    .container { display: flex; flex-direction: column; }
    /* Updated card-display-area style */
    .card-display-area {
        flex-grow: 1; /* Takes up available space */
        display: flex;
        flex-direction: column;
        align-items: center; /* Center card horizontally */
        justify-content: flex-start; /* Align card to the top */
        width: 100%;
    }
    .btn:disabled { cursor: not-allowed; }
</style>
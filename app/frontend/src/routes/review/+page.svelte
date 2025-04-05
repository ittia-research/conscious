<!-- src/routes/review/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores'; // Access page data, including form state ($page.form)
	import ReviewCard from '$lib/components/reviewCard.svelte';
	import type { ActionData } from './$types';
	import type { ReviewCardResponse } from '$lib/types';
	import { onMount } from 'svelte';
	// Removed unused import: import { createLogger } from 'vite';

	// --- Props ---
	// Data from the load function (+page.server.ts)
	export let data: { initialCard: ReviewCardResponse | null; loadError?: string };
	// Result of the last completed form action, provided by SvelteKit
	export let form: ActionData; // Type usually comes from './$types'

	// --- State ---
	let currentCard: ReviewCardResponse | null = null;
	let isComplete: boolean = false;
	let errorMessage: string | null = null; // Can be from load error or action failure
	let isLoadError: boolean = false; // Flag specifically for load errors
	let submitting: boolean = false; // Tracks if *any* form action on this page is in progress

	// --- Initialization ---
	onMount(() => {
		// Initialize based on load data *after* component mounts
		if (data.loadError) {
			errorMessage = data.loadError;
			isLoadError = true;
			currentCard = null;
			isComplete = false; // Not complete, just failed to load
		} else {
			currentCard = data.initialCard;
			isLoadError = false;
			if (!currentCard) {
				isComplete = true; // No initial card and no load error means completion
				errorMessage = null;
			} else {
				isComplete = false; // Got an initial card
				errorMessage = null;
			}
		}
        console.log('Initial state:', { currentCard, isComplete, errorMessage, isLoadError });
	});

	// --- Reactive Updates ---
	// This block re-runs whenever props ($page.form, form) or tracked state change
	$: {
		// Update submitting state based on SvelteKit's page store
		submitting = $page.form?.submitting ?? false;

		// Process form action results when 'form' prop updates
		if (form) {
			console.log('Page received form result:', form);
			// Reset component-level error state *before* processing new result,
            // but keep load errors sticky unless explicitly overwritten by success/new error
            if (!isLoadError) {
                 errorMessage = null;
            }

			if (form.success) {
                // Action succeeded
				currentCard = form.nextCard ?? null; // Update card (might be null)
                isLoadError = false; // Successful action overrides load error state
                errorMessage = null; // Clear any previous error messages

				if (!currentCard) {
					console.log('Form success, no next card: setting complete.');
					isComplete = true; // No next card means completion
				} else {
                    console.log('Form success, got next card: setting incomplete.');
					isComplete = false; // Got a new card
				}
			} else if (form.message) {
                // Action failed (used fail() in server action)
                console.log('Form failure:', form.message);
				errorMessage = form.message;
                isLoadError = false; // Action failure overrides load error state status
				// Keep the current card displayed on failure, don't change isComplete status here
                // isComplete remains false unless explicitly set true by success + no card
			}

            // NOTE: We don't manually set `form = null;`. SvelteKit manages the 'form' prop lifecycle.
            // This reactive block will re-run only when a *new* form result arrives.
		}

        // Derived state: Ensure completion is false if we have a card, unless an error exists.
        // This handles potential edge cases but the core logic is above.
        // if (currentCard && !errorMessage) {
        //     isComplete = false;
        // }
        // This derived logic might be overly complex; the form/onMount logic should cover states.
	}

    function clearErrorMessage() {
        // Only allow clearing non-load errors manually
        if (!isLoadError) {
            errorMessage = null;
        }
        // If you want to allow clearing load errors too, remove the isLoadError check.
    }

</script>

<div class="container mx-auto p-4 max-w-2xl">
	<h1 class="text-2xl font-bold mb-6 text-center">Review Highlights</h1>

	<!-- Display Error Messages -->
	{#if errorMessage}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
			<strong class="font-bold">Error:</strong>
			<span class="block sm:inline">{errorMessage}</span>
			{#if isLoadError}
				<p class="text-sm mt-1">Could not load the initial review card. Please try retrying.</p>
			{/if}
            <!-- Allow clearing only non-load errors -->
            {#if !isLoadError}
			    <button class="absolute top-0 bottom-0 right-0 px-4 py-3 text-red-700" on:click={clearErrorMessage} title="Clear message">×</button>
            {/if}
		</div>
	{/if}

	<!-- Display Content Based on State -->
	{#if isLoadError && !currentCard}
        <!-- Specific state: Failed to load initially -->
        <div class="text-center py-10 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded">
            <p class="font-bold text-lg">Loading Failed</p>
            <p>{errorMessage || 'Could not start the review session.'}</p>
            <form method="POST" action="?/getNext" use:enhance class="mt-4">
                 <button
                     type="submit"
                     class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-150 disabled:opacity-50"
                     disabled={submitting}
                 >
                     {#if submitting} <span class="animate-spin inline-block mr-1">⏳</span> {/if} Retry Loading
                 </button>
             </form>
        </div>

    {:else if isComplete}
		<!-- State: All cards reviewed -->
		<div class="text-center py-10 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
			<p class="font-bold text-lg">All Done!</p>
			<p>You've reviewed all available cards for now.</p>
			<form method="POST" action="?/getNext" use:enhance class="mt-4">
				<button
					type="submit"
					class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-150 disabled:opacity-50"
					disabled={submitting}
				>
					{#if submitting} <span class="animate-spin inline-block mr-1">⏳</span> {/if} Check for More Cards
				</button>
			</form>
		</div>

    {:else if currentCard}
        <!-- State: Actively reviewing a card -->
		<ReviewCard card={currentCard} {submitting} />
        <!-- The ReviewCard component itself should contain the pass/fail forms -->

    {:else if !submitting}
        <!-- Fallback state: No card, not complete, not loading error (e.g., edge case or initial render before onMount) -->
         <div class="text-center py-10">
             <p>Loading review session...</p>
              <!-- Might show a spinner here -->
         </div>
	{/if}

	<!-- Global Loading Indicator -->
	{#if submitting}
		<div class="fixed bottom-4 right-4 bg-gray-700 text-white text-sm py-2 px-4 rounded shadow-lg animate-pulse z-50">
			Processing...
		</div>
	{/if}

</div>
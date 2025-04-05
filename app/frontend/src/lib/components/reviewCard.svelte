<!-- src/lib/components/ReviewCard.svelte -->
<script lang="ts">
	import type { ReviewCardResponse } from '$lib/types';
	import { enhance } from '$app/forms'; // Import enhance for progressive enhancement
    import { fade } from 'svelte/transition'; // Optional: for visual feedback

	// Props: Data is passed down from the page
	export let card: ReviewCardResponse | null;
    // Prop to indicate if an action is currently processing (controlled by page)
	export let submitting: boolean = false;

	let showAnswer: boolean = false;

	// Reset showAnswer when the card changes
	$: if (card) {
		showAnswer = false;
	}

	const grades = [
		{ label: 'Again', value: 1, color: 'bg-red-500 hover:bg-red-600' },
		{ label: 'Hard', value: 2, color: 'bg-orange-500 hover:bg-orange-600' },
		{ label: 'Good', value: 3, color: 'bg-green-500 hover:bg-green-600' },
		{ label: 'Easy', value: 4, color: 'bg-blue-500 hover:bg-blue-600' }
	];
</script>

{#if card}
    <div in:fade={{ duration: 200 }} class="review-card-module bg-white shadow-md rounded px-6 py-5 mb-4">
        <!-- Card Content -->
        <div class="mb-6 min-h-[80px] p-4 border rounded bg-gray-50">
            <p class="text-gray-800 text-lg whitespace-pre-wrap">{card.text}</p>
        </div>

        <!-- Interaction Area -->
        {#if !showAnswer}
            <div class="text-center">
                <button
                    type="button" 
                    class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-6 rounded transition duration-150"
                    on:click={() => showAnswer = true}
                    disabled={submitting}
                >
                    Show Answer & Options
                </button>
            </div>
        {:else}
             <!-- Grading Buttons Form -->
            <p class="text-center text-sm text-gray-500 mb-3">How well did you recall this?</p>
            <div class="flex justify-center flex-wrap gap-2 mb-4">
                {#each grades as gradeInfo}
                    <form method="POST" action="?/submitGrade" use:enhance>
                         <input type="hidden" name="thoughtId" value={card.thought_id} />
                         <input type="hidden" name="grade" value={gradeInfo.value} />
                         <button
                            type="submit"
                            class="{gradeInfo.color} text-white font-bold py-2 px-4 rounded transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
                            disabled={submitting}
                        >
                             {#if submitting} <span class="animate-spin inline-block mr-1">⏳</span> {/if} {gradeInfo.label}
                        </button>
                    </form>
                {/each}
            </div>

             <!-- Discard Button Form -->
      
             <div class="text-center border-t pt-3 mt-3">
                <form method="POST" action="?/discardCard" use:enhance>
                    <input type="hidden" name="thoughtId" value={card.thought_id} />
                    <button
                        type="submit"
                        class="text-sm text-gray-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={submitting}
                        title="Remove this card from future reviews"
                    >
                         {#if submitting} <span class="animate-spin inline-block mr-1">⏳</span> {/if} Discard this card
                    </button>
                </form>
            </div>
        {/if}

        {#if submitting}
            <!-- General submitting indicator (optional, button spinners might be enough) -->
             <!-- <div class="text-center mt-3 text-sm text-blue-500 animate-pulse">Processing...</div> -->
        {/if}
    </div>
{:else}
    <!-- Placeholder or message when card is null (handled by page now) -->
{/if}
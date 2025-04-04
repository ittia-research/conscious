<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';

	// --- Props ---
	export let form: ActionData = undefined;
	export let data: PageData;

	// --- Destructure Load Data ---
	// Only expect configs and potential loadError now
	const { configs = {}, loadError = null } = data ?? {};
	const configTypes = Object.keys(configs ?? {});

	// --- Component State ---
	let isLoading = false;
	let textValue: string = '';
	let selectedType: string | null = null; // Initialize to null for placeholder
	let identifierValues: { [key: string]: string } = {};
    let errorMessage: string | null = null; // For action errors

	// --- Reactive Calculations ---
	// Calculate available identifier keys based on the selected type
	$: currentIdentifierKeys = (selectedType && configs && configs[selectedType]?.keys)
                                ? Object.keys(configs[selectedType].keys)
                                : [];

    // Determine if any *required* identifiers for the current type are missing
    // (Assumes config structure like: configs[type].keys[key] = { required: true })
    // Adjust the 'required' check based on your actual config structure
    $: missingRequiredIdentifiers = currentIdentifierKeys.some(key =>
        (configs[selectedType]?.keys[key]?.required ?? false) && // Check if key is marked required
        !identifierValues[key]?.trim() // Check if the value is empty or whitespace
    );


    // --- State Synchronization Functions ---

    // Ensures identifierValues object has the correct keys for the current type
    function syncIdentifierKeys(type: string | null) {
        const newKeys = (type && configs && configs[type]?.keys)
                        ? Object.keys(configs[type].keys)
                        : [];

        let updatedValues: { [key: string]: string } = {}; // Start fresh
        let changed = false;

        // Populate with existing values if keys match, otherwise initialize
        newKeys.forEach(key => {
            if (key in identifierValues) {
                updatedValues[key] = identifierValues[key];
            } else {
                updatedValues[key] = ''; // Initialize new keys
                changed = true; // Mark as changed if a key was added
            }
        });

         // Check if the final object is different from the current state
        if (Object.keys(updatedValues).length !== Object.keys(identifierValues).length || changed) {
            identifierValues = updatedValues;
        } else {
            // Deep comparison if needed, but usually length check + added key check is sufficient
            let deepEqual = true;
            for(const key of newKeys) {
                if (updatedValues[key] !== identifierValues[key]) {
                    deepEqual = false;
                    break;
                }
            }
            if (!deepEqual) {
                 identifierValues = updatedValues;
            }
        }
    }

    // Updates component state based on data returned from a form action
    function updateStateFromFormAction(actionData: ActionData | undefined) {
        if (!actionData) {
            // If form becomes undefined (e.g., navigation), reset basic state
            // Might need more sophisticated reset depending on desired UX on navigation
            // textValue = ''; // Decide if you want to clear on navigation
            // selectedType = null;
            // identifierValues = {};
            errorMessage = null;
            return;
        }

        console.log('Updating state from form action:', actionData);
        // Always update text, type, and identifiers from the form action result (even on error)
        // to ensure the form reflects the state submitted or the reason for failure.
        textValue = String(actionData.text ?? ''); // Use ?? '' as fallback
        selectedType = actionData.selectedType ?? null; // Use ?? null as fallback
        // Carefully update identifiers: Use action data if present, otherwise clear/sync
        identifierValues = actionData.identifierValues ? { ...actionData.identifierValues } : {};

        // Ensure keys are synced after potential type change from action result
        syncIdentifierKeys(selectedType);

        // Update error message (will be null if action was successful)
        errorMessage = actionData.error ? String(actionData.error) : null;
    }

	// --- Lifecycle ---
	onMount(() => {
        // When the component mounts:
        // - If `form` exists (e.g., validation error on initial load/refresh), update state from it.
        // - Otherwise, it's a fresh load, initialize basic state.
        if (form !== undefined) {
            updateStateFromFormAction(form);
        } else {
            // Initial setup for a clean load
            textValue = '';
            selectedType = null; // Start with placeholder
            identifierValues = {};
            errorMessage = null;
            // Pre-select first type if desired:
            // if (configTypes.length > 0) {
            //     selectedType = configTypes[0];
            //     syncIdentifierKeys(selectedType);
            // }
        }
	});


	// --- Reactive Statements for State Synchronization ---

    // Recalculate/sync identifier keys whenever the selected type *or* configs change
	$: syncIdentifierKeys(selectedType);

    // When the user manually changes the type (detected by checking against form action result),
    // clear the identifier values for the *new* type to avoid submitting stale data.
	$: if (selectedType !== form?.selectedType && form !== undefined) {
        // This condition tries to differentiate user change vs. form action update.
        // A simpler approach might be needed if this causes issues.
        console.log(`Type changed to: ${selectedType}. Clearing identifiers.`);
        const keysForNewType = (selectedType && configs && configs[selectedType]?.keys)
                                ? Object.keys(configs[selectedType].keys)
                                : [];
        const clearedValues: { [key: string]: string } = {};
        keysForNewType.forEach(k => { clearedValues[k] = ''; });
        identifierValues = clearedValues;
	}

	// Process form action results when `form` prop changes.
    // This is the primary way state gets updated after a submission.
	$: updateStateFromFormAction(form);

    // Derived state for convenience
	$: thoughts = form?.success ? (form.thoughts as string[]) : [];


	// --- Form Submission Handlers ---
	function handleSubmitStart() {
		isLoading = true;
		errorMessage = null; // Clear previous errors on new submission
	}
	function handleSubmitEnd() {
		isLoading = false;
	}

    // --- Computed Disabled State ---
    $: isDisabled = isLoading || !!loadError; // Base disabled state
    $: isSubmitDisabled = isDisabled || !textValue.trim() || !selectedType || missingRequiredIdentifiers; // Add check for required fields

</script>

<div class="container mx-auto p-6 md:p-8">
	<h1 class="text-2xl md:text-3xl font-bold mb-6 text-gray-800">Find Thoughts</h1>

    <!-- Display Load Error -->
    {#if loadError}
         <div class="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md shadow-sm" role="alert">
             <strong>Error loading configuration:</strong> {loadError} <br/> Input fields have been disabled.
         </div>
    {/if}

	<!-- Form -->
	<form
		method="POST"
		action="?/findThoughts"
		autocomplete="off"
		use:enhance={() => {
			handleSubmitStart(); // Set loading=true, clear errors
			return async ({ update }) => {
                // Runs *after* server action completes
				await update({ reset: false }); // Update `form` prop without resetting native elements
				handleSubmitEnd(); // Set loading=false
			};
		}}
		class="space-y-5 mb-8 p-5 md:p-6 border border-gray-200 rounded-lg shadow bg-white"
        aria-busy={isLoading}
	>
		<!-- Text Area -->
		<div>
			<label for="text" class="block text-sm font-medium text-gray-700 mb-1">Text <span class="text-red-500 ml-1">*</span>:</label>
			<textarea
				id="text"
				name="text"
				rows="6"
				class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
				placeholder="Enter text..."
				bind:value={textValue}
				required
				disabled={isDisabled}
                aria-required="true"
			></textarea>
		</div>

        <!-- Type Selector and Identifiers (only if no load error) -->
        {#if !loadError}
            {#if configTypes.length > 0}
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <!-- Type Selector -->
                    <div>
                        <label for="selectedType" class="block text-sm font-medium text-gray-700 mb-1">Source Type:</label>
                        <select
                            id="selectedType"
                            name="selectedType"
                            class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                            bind:value={selectedType}
                            required
                            disabled={isDisabled}
                            aria-required="true"
                        >
                             <option value={null} disabled selected={selectedType === null}>Select a type...</option>
                            {#each configTypes as typeKey}
                                <option value={typeKey}>{configs[typeKey]?.label ?? typeKey}</option> <!-- Use label from config if available -->
                            {/each}
                        </select>
                    </div>

                    <!-- Dynamic Identifier Inputs Container -->
                    {#if selectedType && currentIdentifierKeys.length > 0}
                        <div class="space-y-3 p-4 border border-dashed border-gray-200 rounded-md mt-0 md:mt-0"> <!-- Adjust margin if needed -->
                            <h3 class="text-sm font-medium text-gray-600">Source Identifiers <span class="text-gray-400 text-xs">(for '{configs[selectedType]?.label ?? selectedType}')</span>:</h3>
                            {#each currentIdentifierKeys as key (key)} <!-- Keyed each block -->
                                {@const fieldConfig = configs[selectedType]?.keys[key]}
                                {@const isRequired = fieldConfig?.required ?? false}
                                <div>
                                    <label for="identifier_{key}" class="block text-sm font-medium text-gray-700 mb-1 capitalize">
                                        {fieldConfig?.label ?? key}{#if isRequired}<span class="text-red-500 ml-1">*</span>{/if}:
                                     </label>
                                    <input
                                        type={fieldConfig?.type ?? 'text'}
                                        id="identifier_{key}"
                                        name="identifier_{key}"
                                        class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        placeholder={`Enter ${fieldConfig?.label ?? key}...`}
                                        bind:value={identifierValues[key]}
                                        required={isRequired}
                                        disabled={isDisabled}
                                        aria-required={isRequired ? 'true' : 'false'}
                                    />
                                    {#if fieldConfig?.description}
                                        <p class="text-xs text-gray-500 mt-1">{fieldConfig.description}</p>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {:else if selectedType}
                         <!-- Optional: Message if a type is selected but has no keys -->
                          <div class="p-4 border border-dashed border-transparent rounded-md mt-0 md:mt-0 flex items-center justify-center text-sm text-gray-500">
                              No specific identifiers needed.
                          </div>
                    {/if}
                 </div> <!-- End grid -->
            {:else}
                 <!-- Message if configs loaded but were empty -->
                 <p class="text-gray-500 italic">No source types are currently configured.</p>
            {/if}
        {/if} <!-- End !loadError check -->


		<!-- Submit Button -->
        <div class="pt-2">
            <button
                type="submit"
                class="inline-flex items-center px-5 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={isSubmitDisabled}
                aria-live="polite"
            >
                {#if isLoading}
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                {:else}
                    Think
                {/if}
            </button>
            {#if !isLoading && isSubmitDisabled && !isDisabled && !loadError}
                 <span class="text-sm text-red-600 ml-4">Please fill in all required fields (*)</span>
            {/if}
        </div>
	</form>

	<!-- Display Action Error Messages -->
	{#if errorMessage && !isLoading}
		<div class="mb-6 p-4 bg-red-50 border border-red-300 text-red-700 rounded-lg shadow-sm" role="alert">
			<h3 class="font-medium text-red-800">Error</h3>
			<p>{errorMessage}</p>
		</div>
	{/if}

	<!-- Display Results -->
	{#if !isLoading && form?.success }
        <div class="mt-8 p-5 border border-gray-200 rounded-lg bg-gray-50 shadow-sm">
            <h2 class="text-xl font-semibold mb-4 text-gray-700">Results</h2>
             <!-- Context for the results -->
            <div class="text-sm text-gray-600 mb-4 p-3 rounded border border-gray-200 bg-white">
                <p><strong>Type:</strong> <code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs">{configs[form?.selectedType]?.label ?? form?.selectedType ?? 'N/A'}</code></p>
                {#if form?.identifierValues && Object.keys(form.identifierValues).length > 0}
                    <p class="mt-1"><strong>Identifiers:</strong>
                        {#each Object.entries(form.identifierValues) as [key, value]}
                            <span class="inline-block mr-2 mt-1">
                                <code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs capitalize">{configs[form?.selectedType]?.keys[key]?.label ?? key}: {value}</code>
                            </span>
                        {/each}
                    </p>
                {/if}
                <p class="mt-1"><strong>Text:</strong> <code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs line-clamp-2" title={form?.text ?? ''}>{form?.text ?? ''}</code></p>
             </div>

            <!-- List of thoughts -->
            {#if thoughts.length > 0}
                <h3 class="text-md font-medium text-gray-600 mb-2">Thoughts:</h3>
                <ul class="space-y-2 list-disc list-inside bg-white p-4 rounded-md border border-gray-200">
                    {#each thoughts as thought, i (i)}
                        <li class="text-gray-800">{thought}</li>
                    {/each}
                </ul>
            {:else}
                 <!-- Message for success but no results found -->
                 <div class="text-gray-600 bg-yellow-50 p-3 rounded border border-yellow-200 text-center">
                    <p>No thoughts were found matching the provided criteria.</p>
                </div>
            {/if}
        </div>
	{/if}

</div>

<style>
  /* Additional style for better visual feedback on disabled state if needed */
  /* Tailwind's disabled:opacity-60 disabled:cursor-not-allowed usually suffice */

  /* Simple line clamp utility if not using Tailwind plugin */
  .line-clamp-2 {
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
  }
</style>
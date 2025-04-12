<!-- src/routes/add-data/+page.svelte -->
<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	export let data: PageData;
	export let form: ActionData;

	// --- State ---
	let selectedTask: string = '';
	let selectedSourceType: string = '';
	let identifierValues: { [key: string]: string } = {};
	let textInputs: string[] = [''];
	let selectedFile: File | null = null;
	let fileName: string = '';
	let loading: boolean = false;
	let initialLoadComplete = false; // Flag to prevent URL updates AND state updates during initial mount setup

	let fileInputRef: HTMLInputElement;

	// --- Reactive Computations ---
	$: tasks = data.configs?.tasks ? Object.keys(data.configs.tasks) : [];
	$: availableSources = selectedTask ? data.configs?.tasks?.[selectedTask] ?? [] : [];
	$: selectedSourceConfig = selectedSourceType
		? data.configs?.sources?.[selectedSourceType] ?? null
		: null;

	$: identifierKeys = selectedSourceConfig?.keys
		? Object.entries(selectedSourceConfig.keys).map(([key, config]) => ({
				key: key,
				label: (config as any).label || key,
				required: (config as any).required || false,
				desc: (config as any).desc || '',
				examples: (config as any).examples || []
			}))
		: [];

	// Reset identifierValues when identifierKeys change
	$: {
		const newIdentifierValues: { [key: string]: string } = {};
		identifierKeys.forEach((idKey) => {
			// Preserve existing values if key still exists, otherwise initialize
			newIdentifierValues[idKey.key] = identifierValues[idKey.key] || '';
		});
		identifierValues = newIdentifierValues;
	}

	$: hasValidFile = !!selectedFile && selectedFile.size > 0;
	$: hasValidText = textInputs.some((text) => text.trim() !== '');
	$: isDataContentProvided = hasValidFile || hasValidText;

	$: isReadyToSubmit =
		selectedTask &&
		selectedSourceType &&
		isDataContentProvided &&
		!identifierKeys.some((k) => k.required && !(identifierValues[k.key] || '').trim());

	// --- Helper Function to Update State from URL ---
    // Moved logic from onMount here to be reusable
	function updateStateFromUrlParams(params: URLSearchParams) {
		const taskFromUrl = params.get('task') || '';
		const sourceFromUrl = params.get('source') || '';
        let taskChanged = false;

        // Only update state if URL param is different from current state AND is valid
		if (taskFromUrl !== selectedTask) {
            if (tasks.includes(taskFromUrl)) {
                selectedTask = taskFromUrl;
                taskChanged = true;
                // Crucially, reset source type when task changes from URL
                // This ensures the source dropdown populates correctly and prevents
                // keeping a source that's invalid for the new task.
                selectedSourceType = '';
            } else if (taskFromUrl === '' && selectedTask !== '') {
                // Handle case where URL removes the task parameter
                selectedTask = '';
                selectedSourceType = ''; // Also clear source
                taskChanged = true;
            }
        }

        // Update source based on URL, but wait for availableSources if task just changed
        const updateSource = () => {
            // Re-check available sources based on the potentially updated selectedTask
            const currentAvailableSources = selectedTask ? data.configs?.tasks?.[selectedTask] ?? [] : [];

            if (sourceFromUrl !== selectedSourceType) {
                if (
                    selectedTask && // Task must be selected
                    sourceFromUrl && // Source must be in URL
                    currentAvailableSources.includes(sourceFromUrl) // Source must be valid for the task
                ) {
                    selectedSourceType = sourceFromUrl;
                } else if (!sourceFromUrl && selectedSourceType !== '') {
                     // Handle case where URL removes the source parameter (or task changed clearing it)
                     selectedSourceType = '';
                } else if (selectedTask && sourceFromUrl && !currentAvailableSources.includes(sourceFromUrl)) {
                     // Handle case where source in URL is invalid for the current task
                     selectedSourceType = ''; // Clear invalid source
                }
            } else if (taskChanged && sourceFromUrl === '' && selectedSourceType !== '') {
                 // If task changed and URL doesn't specify a source, ensure it's cleared
                 selectedSourceType = '';
            }

             // Auto-select source if task is set (from URL) and only one source is available and none is selected
            if (selectedTask && !selectedSourceType && currentAvailableSources.length === 1) {
                selectedSourceType = currentAvailableSources[0];
            }
        };

        if (taskChanged) {
            // Wait for reactivity to update availableSources
            setTimeout(updateSource, 0);
        } else {
            // Task didn't change, update source immediately if needed
            updateSource();
        }
	}

	// --- Lifecycle ---
	onMount(() => {
        // Initial state hydration from URL
		updateStateFromUrlParams($page.url.searchParams);
        // Allow reactive updates AFTER initial setup is done
		initialLoadComplete = true;
	});

    // --- Reactive URL Sync ---

    // 1. Update Component State FROM URL Changes (The Fix)
    // This runs whenever the URL search params change *after* the initial load.
    $: if (initialLoadComplete) {
        // console.log("URL changed, re-evaluating state:", $page.url.search);
        updateStateFromUrlParams($page.url.searchParams);
    }

	// 2. Update URL FROM Component State Changes (Existing logic)
	// This runs when user interacts with selects *after* initial load.
	$: if (initialLoadComplete && (selectedTask || selectedSourceType)) {
		const newUrl = new URL($page.url);
        let urlChanged = false;

		if (selectedTask) {
            if (newUrl.searchParams.get('task') !== selectedTask) {
			    newUrl.searchParams.set('task', selectedTask);
                urlChanged = true;
            }
		} else {
            if (newUrl.searchParams.has('task')) {
			    newUrl.searchParams.delete('task');
                urlChanged = true;
            }
            if (newUrl.searchParams.has('source')) { // Remove source if task is removed
                newUrl.searchParams.delete('source');
                urlChanged = true;
            }
		}

		if (selectedSourceType && selectedTask) { // Only set source if task is also set
            if (newUrl.searchParams.get('source') !== selectedSourceType) {
			    newUrl.searchParams.set('source', selectedSourceType);
                urlChanged = true;
            }
		} else {
            if (newUrl.searchParams.has('source')) {
			    newUrl.searchParams.delete('source');
                urlChanged = true;
            }
		}

		// Avoid pushing history state if URL isn't actually changing
		if (urlChanged && newUrl.search !== $page.url.search) {
            // console.log("State changed, updating URL to:", newUrl.search);
			goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true });
		}
	} else if (initialLoadComplete && !selectedTask && !selectedSourceType) {
		// Clear params if both are deselected manually
		const newUrl = new URL($page.url);
		if (newUrl.searchParams.has('task') || newUrl.searchParams.has('source')) {
			newUrl.searchParams.delete('task');
			newUrl.searchParams.delete('source');
            // console.log("State cleared, updating URL to remove params");
			goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true });
		}
	}


	// --- Event Handlers ---
	function handleTaskChange() {
        // This function is now primarily triggered by user interaction with the select.
        // The reactive block above handles URL-driven changes.
        // We still need to reset source type when user changes task via dropdown.
		selectedSourceType = '';
		identifierValues = {}; // Reset identifiers specific to the old source

        // Auto-select is handled reactively by updateStateFromUrlParams
        // and the URL update block if necessary, but we can trigger
        // an immediate check after user interaction too.
		setTimeout(() => {
            const currentAvailableSources = selectedTask ? data.configs?.tasks?.[selectedTask] ?? [] : [];
			if (selectedTask && !selectedSourceType && currentAvailableSources.length === 1) {
				selectedSourceType = currentAvailableSources[0];
			}
            // The reactive block `$: if (initialLoadComplete && (selectedTask || selectedSourceType))`
            // will handle updating the URL based on this state change.
		}, 0);
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			selectedFile = target.files[0];
			fileName = selectedFile.name;
		} else {
			clearFileSelection();
		}
	}

	function clearFileSelection() {
		selectedFile = null;
		fileName = '';
		if (fileInputRef) {
			fileInputRef.value = '';
		}
	}

	function addTextInput() {
		textInputs = [...textInputs, ''];
	}

	function removeTextInput(index: number) {
		textInputs = textInputs.filter((_, i) => i !== index);
		if (textInputs.length === 0) {
			textInputs = [''];
		}
	}

	function resetFormFields() {
		textInputs = [''];
		clearFileSelection();
		const newIdentifierValues: { [key: string]: string } = {};
		identifierKeys.forEach((idKey) => {
			newIdentifierValues[idKey.key] = '';
		});
		identifierValues = newIdentifierValues;
	}

	// Form submission feedback
	$: if (form) {
		loading = false;
		if (form.success) {
			// console.log('Form Success:', form.message);
			resetFormFields();
		} else {
			// console.error('Form Error:', form.message, 'Field:', form.field);
			if (form.field) {
				const errorElement =
					document.querySelector(`[name="${form.field}"]`) ||
					document.getElementById(`${form.field}_section`) ||
					document.getElementById(form.field);
				errorElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				// Add short delay before focus, can help sometimes
                setTimeout(() => { errorElement?.focus({ preventScroll: true }); }, 50);
			}
		}
	}
</script>

<!-- HTML structure remains the same as the previous version -->
<!-- ... (keep the template section from the previous response) ... -->

<!-- Requirement 1 & 6: Plainer style, reduced padding/margins -->
<div class="container mx-auto px-3 py-5 md:px-4 md:py-6 max-w-2xl font-sans">
	<h1 class="text-xl font-semibold mb-5 text-gray-800">Add New</h1>

	{#if data.error}
		<!-- Requirement 1: Simpler error display -->
		<div class="border-l-4 border-red-500 text-red-700 px-3 py-2 mb-4 text-sm" role="alert">
			<strong>Error loading configuration:</strong>
			<span class="ml-1">{data.error}</span>
		</div>
	{:else if !data.configs && !data.error}
		<div
			class="border-l-4 border-yellow-500 text-yellow-700 px-3 py-2 mb-4 text-sm"
			role="status"
		>
			Loading configuration...
		</div>
	{/if}

	{#if data.configs}
		<!-- Requirement 1 & 6: Reduced spacing -->
		<form
			method="POST"
			enctype="multipart/form-data"
			use:enhance={() => {
				loading = true;
				if (!isDataContentProvided) {
					loading = false;
					form = {
						success: false,
						message: 'Please provide data via file upload or text input.',
						field: 'data_content' // This will trigger the error display and focus logic
					};
					return ({ cancel }) => cancel();
				}
				// Reset form feedback before submitting again
                form = undefined;
				return async ({ update }) => {
					await update();
				};
			}}
			class="space-y-5"
		>
			<!-- Task and Source Selection -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="task" class="block text-xs font-medium text-gray-600 mb-1"
						>Task <span class="text-red-500">*</span></label
					>
					<select
						id="task"
						name="task"
						bind:value={selectedTask}
						on:change={handleTaskChange}
						required
						class="w-full p-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none text-sm bg-white disabled:bg-gray-50"
						disabled={loading}
						aria-describedby={form?.field === 'task' ? 'task-error' : undefined}
					>
						<option value="" disabled>Select Task</option>
						{#each tasks as taskName}
							<option value={taskName}>{data.configs?.tasks?.[taskName]?.label ?? taskName}</option>
						{/each}
					</select>
					{#if form?.field === 'task'}
						<p id="task-error" class="text-red-500 text-xs mt-1">{form.message}</p>
					{/if}
				</div>

				<div>
					<label for="sourceType" class="block text-xs font-medium text-gray-600 mb-1"
						>Source Type <span class="text-red-500">*</span></label
					>
					<select
						id="sourceType"
						name="sourceType"
						bind:value={selectedSourceType}
						required
						disabled={!selectedTask || availableSources.length === 0 || loading}
						class="w-full p-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none text-sm bg-white disabled:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
						aria-describedby={form?.field === 'sourceType' ? 'sourceType-error' : undefined}
					>
						<option value="" disabled
							>{!selectedTask ? 'Select Task first' : availableSources.length === 0 ? 'No sources available' : 'Select Source Type'}</option
						>
						{#each availableSources as sourceName}
							<option value={sourceName}
								>{data.configs?.sources?.[sourceName]?.label ?? sourceName}</option
							>
						{/each}
					</select>
					{#if form?.field === 'sourceType'}
						<p id="sourceType-error" class="text-red-500 text-xs mt-1">{form.message}</p>
					{/if}
				</div>
			</div>

			<!-- Dynamic Identifier Inputs -->
			{#if selectedSourceType && identifierKeys.length > 0}
				<div class="pt-1">
					<h2 class="text-sm font-medium text-gray-700 mb-2">Source Details</h2>
					<div class="space-y-3">
						{#each identifierKeys as idKey (idKey.key)}
							<div id="identifier_{idKey.key}_section">
								<label
									for="identifier_{idKey.key}"
									class="block text-xs font-medium text-gray-600 mb-1"
								>
									{idKey.label}
									{#if idKey.required}<span class="text-red-500">*</span>{/if}
								</label>
								{#if idKey.desc}
									<p class="text-xs text-gray-500 mb-1">{idKey.desc}</p>
								{/if}
								<input
									type="text"
									id="identifier_{idKey.key}"
									name="identifier_{idKey.key}"
									bind:value={identifierValues[idKey.key]}
									required={idKey.required}
									placeholder={idKey.examples?.length > 0 ? `e.g., ${idKey.examples[0]}` : ''}
									class="w-full p-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none text-sm disabled:bg-gray-50"
									disabled={loading}
                                    aria-describedby={form?.field === `identifier_${idKey.key}` ? `identifier_${idKey.key}-error` : undefined}
								/>
								{#if form?.field === `identifier_${idKey.key}`}
									<p id="identifier_{idKey.key}-error" class="text-red-500 text-xs mt-1">{form.message}</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Data Content (File / Text) -->
			<div id="data_content_section">
				<h2 class="text-sm font-medium text-gray-700 mb-1">
					Content <span class="text-red-500">*</span>
				</h2>
				<p class="text-xs text-gray-500 mb-3">
					Upload a file or enter text
				</p>
				{#if form?.field === 'data_content'}
					<p class="text-red-600 text-xs mb-2 bg-red-50 p-1 rounded-sm">{form.message}</p>
				{/if}

				<!-- File Input Area -->
				<div id="file_section">
					<label for="fileInput" class="block text-xs font-medium text-gray-600 mb-1"
						>Upload File</label
					>
					<div class="flex items-center space-x-2">
						<input
							type="file"
							id="fileInput"
							name="file"
							bind:this={fileInputRef}
							on:change={handleFileChange}
							class="block w-full text-sm text-gray-700 border border-gray-300 rounded-sm cursor-pointer
                                   file:mr-2 file:py-1.5 file:px-3 file:border-0
                                   file:text-sm file:font-medium
                                   file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200
                                   focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500
                                   disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={loading}
                            aria-describedby={form?.field === 'file' ? 'file-error' : undefined}

						/>
						{#if selectedFile}
							<button
								type="button"
								on:click={clearFileSelection}
								class="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
								title="Clear selected file"
								disabled={loading}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
					{#if fileName && !selectedFile}
						<p class="text-xs text-gray-500 mt-1 italic">File cleared.</p>
					{:else if fileName}
						<p class="text-xs text-gray-600 mt-1">Selected: {fileName}</p>
					{/if}

					{#if form?.field === 'file'}
						<p id="file-error" class="text-red-500 text-xs mt-1">{form.message}</p>
					{/if}
				</div>

				<hr class="my-4 border-gray-200 " />

				<!-- Text Inputs Area -->
				<div id="textInput_section"> 
					<label class="block text-xs font-medium text-gray-600 mb-1">Enter Text</label>
					{#each textInputs as text, index (index)}
						<div
							class="flex items-start space-x-1.5 mb-1.5"
							transition:fade|local={{ duration: 150 }}
						>
							<textarea
								name="textInput"
								rows="3"
								bind:value={textInputs[index]}
								placeholder="text here..."
								class="flex-grow p-2 border border-gray-300 rounded-sm focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none text-sm resize-y disabled:bg-gray-50"
								disabled={loading}
                                aria-describedby={form?.field === 'textInput' ? 'textInput-error' : undefined}
							></textarea>
							<button
								type="button"
								on:click={() => removeTextInput(index)}
								class="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50 mt-1"
								title="Remove text box"
								disabled={loading}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/each}
					<button
						type="button"
						on:click={addTextInput}
						class="mt-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={loading}
					>
						+ Add text input
					</button>
					{#if form?.field === 'textInput'}
						<p id="textInput-error" class="text-red-500 text-xs mt-1">{form.message}</p>
					{/if}
				</div>
			</div>

			<!-- Submission -->
			<div class="flex items-center justify-end space-x-3 pt-3 border-t border-gray-200 mt-5">
				{#if form && form.message && form.field !== 'data_content' && !form.field?.startsWith('identifier_') && form.field !== 'file' && form.field !== 'textInput' && form.field !== 'task' && form.field !== 'sourceType' }
					<!-- General Feedback (non-field specific shown above) -->
                    <div
						class:text-green-600={form.success}
						class:text-red-600={!form.success}
						class="text-xs"
						role={form.success ? 'status' : 'alert'}
						transition:fade={{ duration: 300 }}
					>
						{form.message}
					</div>
				{/if}

				<button
					type="submit"
					class="inline-flex justify-center items-center py-1.5 px-5 border border-transparent text-sm font-medium rounded-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
					disabled={loading || !isReadyToSubmit}
					title={!isReadyToSubmit ? 'Fill required fields (*) and provide file or text.' : 'Submit'}
				>
					{#if loading}
						<svg
							class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Processing...
					{:else}
						Add
					{/if}
				</button>
			</div>
		</form>
	{:else if !data.error}
		<p class="text-gray-500 text-sm animate-pulse">Loading form elements...</p>
	{/if}
</div>
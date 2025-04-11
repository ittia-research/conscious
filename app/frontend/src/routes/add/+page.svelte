<!-- src/routes/add-data/+page.svelte -->
<script lang="ts">
    import type { PageData, ActionData } from './$types';
    import { enhance } from '$app/forms';
    import { fade } from 'svelte/transition';

    export let data: PageData;
    export let form: ActionData;

    let selectedTask: string = '';
    let selectedSourceType: string = '';

    let identifierValues: { [key: string]: string } = {};
    let textInputs: string[] = [''];
    let selectedFile: File | null = null;
    let fileName: string = '';
    let loading: boolean = false;


    $: tasks = data.configs?.tasks ? Object.keys(data.configs.tasks) : [];
    $: availableSources = data.configs?.tasks?.[selectedTask] ?? [];
    $: selectedSourceConfig = data.configs?.sources?.[selectedSourceType] ?? null;

    // Identifier keys needed for the selected source
    $: identifierKeys = selectedSourceConfig?.keys
        ? Object.entries(selectedSourceConfig.keys).map(([key, config]) => ({
                key: key,
                label: (config as any).label || key,
                required: (config as any).required || false,
                desc: (config as any).desc || '',
                examples: (config as any).examples || []
          }))
        : [];

    // Use a reactive statement that DEPENDS ON identifierKeys to reset identifierValues.
    // This ensures identifierValues is updated AFTER identifierKeys has been recalculated.
    $: {
        const newIdentifierValues: { [key: string]: string } = {};
        identifierKeys.forEach(idKey => {
            // Initialize with empty string for the new set of keys
            newIdentifierValues[idKey.key] = '';
        });
        // Assigning a new object reference helps Svelte detect the change reliably
        identifierValues = newIdentifierValues;
        // console.log('Reset identifierValues:', identifierValues); // Debug log
    }


    // --- Event Handlers ---

    function handleTaskChange() {
        // Reset source type, this will trigger downstream reactive updates
        // for availableSources, selectedSourceConfig, identifierKeys, and finally identifierValues.
        selectedSourceType = '';

        // Auto-select source if only one is available
        if (availableSources.length === 1) {
            selectedSourceType = availableSources[0];
        }
    }

    function handleSourceChange() {
        // This function is still triggered by the on:change event on the source select,
        // but the crucial state updates (identifierKeys, identifierValues) happen
        // reactively based on the new selectedSourceType value.
        // We could potentially remove this function if the select only binds value.
    }

    function handleFileChange(event: Event) {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            selectedFile = target.files[0];
            fileName = selectedFile.name;
        } else {
            selectedFile = null;
            fileName = '';
        }
    }

    function addTextInput() {
        textInputs = [...textInputs, ''];
    }

    function removeTextInput(index: number) {
        if (textInputs.length > 1) {
            textInputs = textInputs.filter((_, i) => i !== index);
        } else {
            textInputs = [''];
        }
    }

    function resetForm() {
        selectedTask = ''; // Trigger reactivity to reset dependent fields
        textInputs = [''];
        selectedFile = null;
        fileName = '';
        const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
        if (fileInput) {
            fileInput.value = '';
        }
    }

    // Handle feedback from the form action
    $: if (form) {
        loading = false;
        if (form.success) {
            console.log('Form Success:', form.message);
             resetForm(); // Reset form on success
        } else {
            console.error('Form Error:', form.message);
        }
    }

</script>

<div class="container mx-auto p-4 md:p-8 max-w-3xl">
    <h1 class="text-3xl font-bold mb-6 text-gray-800">Add New Data</h1>

    {#if data.error}
        <!-- Error handling for config load -->
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong class="font-bold">Error loading configuration:</strong>
            <span class="block sm:inline">{data.error}</span>
        </div>
    {:else if !data.configs}
        <!-- Loading state for config -->
        <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-6" role="alert">
            Loading configuration...
        </div>
    {/if}


    {#if data.configs}
        <form
            method="POST"
            enctype="multipart/form-data"
            use:enhance={() => {
                loading = true;
                return async ({ update }) => {
                    await update();
                    // Loading state is now handled by the reactive `$: if (form)` block
                };
            }}
            class="space-y-6"
        >
            <!-- Task and Source Selection -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label for="task" class="block text-sm font-medium text-gray-700 mb-1">Task</label>
                    <select
                        id="task"
                        name="task"
                        bind:value={selectedTask}
                        on:change={handleTaskChange}
                        required
                        class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={loading}
                    >
                        <option value="" disabled>Select a Task</option>
                        {#each tasks as taskName}
                            <!-- Use taskName for value, use label for display if available -->
                            <option value={taskName}>{data.configs?.sources?.[taskName]?.label ?? taskName}</option>
                        {/each}
                    </select>
                    {#if form?.field === 'task'}
                        <p class="text-red-500 text-xs mt-1">{form.message}</p>
                    {/if}
                </div>

                <div>
                    <label for="sourceType" class="block text-sm font-medium text-gray-700 mb-1">Source Type</label>
                    <select
                        id="sourceType"
                        name="sourceType"
                        bind:value={selectedSourceType}
                        on:change={handleSourceChange}
                        required
                        disabled={!selectedTask || availableSources.length === 0 || loading}
                        class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                    >
                        <option value="" disabled>Select a Source Type</option>
                        {#each availableSources as sourceName}
                            <option value={sourceName}>{data.configs?.sources?.[sourceName]?.label ?? sourceName}</option>
                        {/each}
                    </select>
                     {#if form?.field === 'sourceType'}
                        <p class="text-red-500 text-xs mt-1">{form.message}</p>
                    {/if}
                </div>
            </div>

            <!-- Dynamic Identifier Inputs -->
            {#if selectedSourceType && identifierKeys.length > 0}
                <div class="p-4 border border-gray-200 rounded-md bg-gray-50">
                     <h2 class="text-lg font-medium text-gray-800 mb-3">Source Identifiers</h2>
                    <div class="space-y-4">
                        <!-- Add key directive to the #each loop for better list diffing -->
                        {#each identifierKeys as idKey (idKey.key)}
                            <div>
                                <label for="identifier_{idKey.key}" class="block text-sm font-medium text-gray-700 mb-1">
                                    {idKey.label} {#if idKey.required}<span class="text-red-500">*</span>{/if}
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
                                    class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    disabled={loading}
                                />
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Data Content (File / Text) -->
            <div class="p-4 border border-gray-200 rounded-md">
                <h2 class="text-lg font-medium text-gray-800 mb-3">Data Content</h2>
                <p class="text-sm text-gray-600 mb-4">Provide data by uploading a file OR entering text below (or both).</p>

                <!-- File Input -->
                <div>
                    <label for="fileInput" class="block text-sm font-medium text-gray-700 mb-1">Upload File (Optional)</label>
                    <div class="flex items-center space-x-2">
                        <input
                            type="file"
                            id="fileInput"
                            name="file"
                            on:change={handleFileChange}
                            class="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-indigo-50 file:text-indigo-700
                                hover:file:bg-indigo-100 disabled:opacity-50"
                            disabled={loading}
                        />
                    </div>
                    {#if fileName}
                        <p class="text-sm text-gray-600 mt-1">Selected: {fileName}</p>
                    {/if}
                </div>

                <div class="my-4 border-t border-gray-200"></div>

                <!-- Text Inputs -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Enter Text (Optional)</label>
                    {#each textInputs as text, index (index)} <!-- Keyed each block -->
                        <div class="flex items-center space-x-2 mb-2" transition:fade|local={{ duration: 200 }}>
                            <textarea
                                name="textInput"
                                rows="3"
                                bind:value={textInputs[index]}
                                placeholder="Enter text content here..."
                                class="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                                disabled={loading}
                            ></textarea>
                            <button
                                type="button"
                                on:click={() => removeTextInput(index)}
                                class="p-2 text-gray-500 hover:text-red-600 disabled:opacity-50"
                                title="Remove text box"
                                disabled={loading || textInputs.length <= 1}
                            >
                                <!-- SVG Icon -->
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    {/each}
                    <button
                        type="button"
                        on:click={addTextInput}
                        class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                        disabled={loading}
                    >
                        + Add another text box
                    </button>
                </div>
            </div>


            <!-- Submission -->
            <div class="flex items-center justify-end space-x-4">
                <!-- Feedback Message -->
                {#if form && form.message }
                    <div
                        class:text-green-800={form.success}
                        class:bg-green-100={form.success}
                        class:text-red-800={!form.success}
                        class:bg-red-100={!form.success}
                        class="text-sm px-3 py-1 rounded"
                        role={form.success ? 'status' : 'alert'}
                        transition:fade={{ duration: 300 }}
                    >
                        {form.message}
                    </div>
                {/if}

                <!-- Submit Button -->
                <button
                    type="submit"
                    class="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || !selectedTask || !selectedSourceType || identifierKeys.some(k => k.required && !identifierValues[k.key])}
                    title={identifierKeys.some(k => k.required && !identifierValues[k.key]) ? 'Please fill all required identifiers' : ''}
                >
                    {#if loading}
                        <!-- Loading Spinner -->
                        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Processing...
                    {:else}
                        Add Data
                    {/if}
                </button>
            </div>
        </form>
    {:else if !data.error}
        <!-- Loading Skeleton or Message -->
        <p class="text-gray-500 animate-pulse">Loading form elements...</p>
    {/if}

</div>
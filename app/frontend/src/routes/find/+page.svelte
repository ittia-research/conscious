<script lang="ts">
  import type { ActionData, PageData } from './$types'; // Import PageData
  import { enhance } from '$app/forms'; // For progressive enhancement
  import { onMount } from 'svelte'; 

  // ActionData contains data returned from the form action (+page.server.ts)
  export let form: ActionData;
  // PageData contains data returned from the load function (+page.server.ts)
  export let data: PageData;

  // Get lock status and defaults from the load function's data
  const isLocked = data.isLocked;
  const defaultText = data.defaultText;
  const defaultIdentifier = data.defaultIdentifier;

  let isLoading = false;

  // Initialize form field values:
  // Use values returned from the action if available (after submission),
  // otherwise use the defaults passed from the load function. --> Initial setup
  let textValue = form?.text ? String(form.text) : defaultText; // Keep this for post-action state
  let identifierValue = form?.identifier ? String(form.identifier) : defaultIdentifier;

  // <-- Add onMount block
  onMount(() => {
    // Force reset values based on load data when component mounts,
    // overriding browser autofill/bfcache restoration.
    textValue = defaultText;
    identifierValue = defaultIdentifier;
  });
 
  // Reactive statements to easily access form results or errors
  $: thoughts = form?.success ? (form.thoughts as string[]) : [];
  $: errorMessage = form?.error ? String(form.error) : null;

  // Ensure form values reset/update correctly after action returns
  // This might override user input briefly if they navigate back/forward,
  // but primarily handles the state after form submission.
  $: if (form?.text !== undefined) textValue = String(form.text);
  $: if (form?.identifier !== undefined) identifierValue = String(form.identifier);
  // If form becomes null/undefined (e.g., navigating away and back), reset to defaults
  $: if (form === null || form === undefined) {
      textValue = defaultText;
      identifierValue = defaultIdentifier;
      errorMessage = null; // Clear errors on reset
      // thoughts = []; // Optionally clear results too
  }


  // Function to handle form submission start/end for loading state
  function handleSubmitStart() {
    isLoading = true;
    errorMessage = null; // Clear previous errors
  }
  function handleSubmitEnd() {
    isLoading = false;
  }

  // When locked, force values back to default just before submission enhancement runs
  function handleBeforeSubmit() {
    if (isLocked) {
      textValue = defaultText;
      identifierValue = defaultIdentifier;
    }
    handleSubmitStart(); // Start loading indicator
  }

</script>

<div class="container mx-auto p-8">
  <h1 class="text-3xl font-bold mb-6">Find Thoughts</h1>

  {#if isLocked}
    <div class="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md" role="status">
      Input is locked. Using default values.
    </div>
  {/if}

  <!-- Use SvelteKit's 'enhance' for progressive enhancement -->
  <form
    method="POST"
    action="?/findThoughts"
    autocomplete="off"
    use:enhance={() => {
      // Run checks/state updates *before* the submission starts
      handleBeforeSubmit();

      return async ({ update }) => {
        // This runs *after* the form submission completes on the server
        await update({ reset: false }); // Update form data, don't reset native form elements
                                        // as Svelte manages state via bind:value
        handleSubmitEnd(); // End loading indicator
      };
    }}
    class="space-y-4 mb-8 p-6 border rounded-lg shadow-md bg-white"
  >
    <div>
      <label for="text" class="block text-sm font-medium text-gray-700 mb-1">Text:</label>
      <textarea
        id="text"
        name="text"
        rows="3"
        class:input-locked={isLocked} 
        class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        class:bg-gray-100={isLocked} 
        placeholder={isLocked ? "Using default value" : "Enter text..."}
        bind:value={textValue}
        required
        readonly={isLocked} 
        disabled={isLoading} 
        aria-readonly={isLocked}
      ></textarea>
    </div>

    <div>
      <label for="identifier" class="block text-sm font-medium text-gray-700 mb-1">Identifier:</label>
      <input
        type="text"
        id="identifier"
        name="identifier"
        class:input-locked={isLocked} 
        class="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        class:bg-gray-100={isLocked} 
        placeholder={isLocked ? "Using default value" : "Enter identifier..."}
        bind:value={identifierValue}
        required
        readonly={isLocked} 
        disabled={isLoading} 
        aria-readonly={isLocked}
      />
    </div>

    <button
      type="submit"
      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isLoading} 
    >
      {#if isLoading}
        <span>Loading...</span>
      {:else}
        <span>Find Thoughts</span>
      {/if}
    </button>
  </form>

  <!-- Display Error Messages -->
  {#if errorMessage && !isLoading}
    <div class="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md" role="alert">
      <p class="font-bold">Error</p>
      <p>{errorMessage}</p>
    </div>
  {/if}

  <!-- Display Results -->
  {#if form?.success && thoughts.length > 0 && !isLoading}
    <div class="mt-8">
      <h2 class="text-2xl font-semibold mb-4">Results:</h2>
       <p class="text-sm text-gray-600 mb-2">Showing results for identifier: <code class="bg-gray-200 px-1 rounded">{form?.identifier}</code> and text starting with: <code class="bg-gray-200 px-1 rounded">{form?.text?.substring(0, 50)}...</code></p>
      <ul class="space-y-2 list-disc list-inside bg-gray-50 p-4 rounded-md border">
        {#each thoughts as thought, i (i)}
          <li class="text-gray-800">{thought}</li>
        {/each}
      </ul>
    </div>
  {:else if form?.success && thoughts.length === 0 && !isLoading}
     <p class="mt-8 text-gray-600">No thoughts found for identifier: <code class="bg-gray-200 px-1 rounded">{form?.identifier}</code> and text starting with: <code class="bg-gray-200 px-1 rounded">{form?.text?.substring(0, 50)}...</code></p>
  {/if}

</div>

<!-- <style>
  /* Optional: Style for locked inputs */
  .input-locked {
     /* Add styles like cursor: not-allowed, different background, etc. if needed */
     /* The readonly attribute and class:bg-gray-100 already provide visual cues */
  }
</style> -->
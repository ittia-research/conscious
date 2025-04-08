// src/lib/stores/audioSettings.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment'; // To check if we are in the browser

const STORAGE_KEY = 'audioGloballyEnabled';

// Default to 'false' (audio enabled) if no setting exists or in SSR
let initialValue = false;
if (browser) {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    // Set initialValue only if a value was explicitly stored as 'true'
    if (storedValue === 'true') {
        initialValue = true;
    }
    // Otherwise, it defaults to false (either no key or key is 'false')
}

// Create the writable store
export const isAudioGloballyEnabled = writable<boolean>(initialValue);

// Subscribe to changes and update localStorage when in the browser
if (browser) {
    isAudioGloballyEnabled.subscribe(value => {
        console.log(`[AudioSettings] Saving global audio state to localStorage: ${value}`);
        localStorage.setItem(STORAGE_KEY, String(value));
    });
}
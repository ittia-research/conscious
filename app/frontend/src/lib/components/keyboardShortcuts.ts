// lib/components/keyboardShortcuts.ts
export function handleKeydown(
    event: KeyboardEvent, 
    shortcuts: Record<string, { type: string; value?: string | number }>
) {
    // Ignore if typing in an input, textarea, etc.
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable) {
        return;
    }

    const key = event.key.toLowerCase();
    const shortcut = shortcuts[key as keyof typeof shortcuts];

    if (!shortcut) {
        return; // Not a defined shortcut
    }

    event.preventDefault(); // Prevent default browser action for the key (e.g., number typing)

    let selector = `button[data-action="${shortcut.type}"]`;
    if ('value' in shortcut) {
        selector += `[value="${shortcut.value}"]`;
    }

    const pageButton = document.querySelector<HTMLButtonElement>(selector);

    // --- Click the button only if found AND not disabled ---
    if (pageButton && !pageButton.disabled) {
        pageButton.click();
    }
}
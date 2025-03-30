import logging
from typing import Any

logger = logging.getLogger(__name__)

def decode_unicode_escapes_logic(value: Any) -> Any:
    """
    Recursively decodes unicode escape sequences in strings or lists of strings.

    Handles:
        - Individual strings (str)
        - Lists containing strings, including nested lists, processes only string items
        - Other types are returned unchanged.

    Why this:
        - Some clients send escape sequences in user input as is, for example:
            - svelte web application user input
        - Some downstream application does not handle escape sequences well, for example:
            - LLM model `gemini/gemini-2.0-flash-thinking-exp-01-21`, 2025-03-30

    TO-DO: any potential issues? Should we enlarge or narrow scope of this convert?
    """
    if isinstance(value, str):
        try:
            original_value = value
            transformed_value = bytes(value, "utf-8").decode("unicode_escape")
            if original_value != transformed_value:
                logger.debug(f"Transforming string (raw representation): '{original_value!r}' -> '{transformed_value!r}'")
            return transformed_value
        except Exception as e:
            # Log error and return original value if transformation fails
            logger.error(f"Error transforming string (raw representation) '{value!r}': {e}")
            return value 
        
    elif isinstance(value, list):
        processed_list = []
        changed = False
        for item in value:
            # Recursively call this function for each item, this allows handling nested lists
            processed_item = decode_unicode_escapes_logic(item)
            if processed_item is not item:
                 changed = True
            processed_list.append(processed_item)

        # Return the new list only if any item was actually changed
        return processed_list if changed else value

    else:
        # Return any other type (int, float, dict, None, etc.) unchanged
        return value

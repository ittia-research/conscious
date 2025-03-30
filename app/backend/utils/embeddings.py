import logging
from litellm import aembedding
from typing import List

from core.config import settings

logger = logging.getLogger(__name__)

EmbeddingVector = List[float]

async def get_embeddings(
    texts: List[str],
    model: str = settings.EMBEDDING_MODEL,
    api_base: str = settings.EMBEDDING_API_BASE,
    api_key: str = settings.EMBEDDING_API_KEY,
) -> List[EmbeddingVector]:
    """
    Generate embeddings for a list of texts.

    Returns:
        A list of embedding vectors (each a list of floats), ordered
        correspondingly to the input `texts` list.

    Raises:
        Exception: Propagates exceptions from the litellm.aembedding call (e.g., connection errors).
        ValueError: If length of embeddings and texts are not equal
    """
    if not texts:
        return [] # Return empty list if input is empty

    try:
        response = await aembedding(
            model=model,
            api_base=api_base,
            api_key=api_key,
            input=texts,
        )
    except Exception as e:
        logger.error(f"Error calling litellm.aembedding: {e}")
        raise

    # TO-DO: should we check order and other aspects of the returned embeddings?
    embeddings = [i['embedding'] for i in response['data']]

    if len(embeddings) != len(texts):
        raise ValueError(f"Length of embeddings ({len(embeddings)}) and texts ({len(texts)}) not equal")
    
    return embeddings
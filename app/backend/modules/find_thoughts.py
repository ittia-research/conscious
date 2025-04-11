import dspy
from typing import List
import logging

from db.session import get_db_session
from .thoughts_services import ThoughtsService
from core.config import settings

logger = logging.getLogger(__name__)


lm = dspy.LM(model=settings.LLM_MODEL, api_key=settings.LLM_API_KEY, cache=settings.DSPY_CACHE)
dspy.settings.configure(lm=lm)
logger.info(f"DSPy configured with model: {settings.LLM_MODEL}")


class FindThoughtsSignature(dspy.Signature):
  """Given a text, identify and list its main thoughts or core ideas, ensuring context and using key original phrasing."""

  text: str = dspy.InputField(
      desc="The source text from which main thoughts need to be extracted."
  )

  main_thoughts: List[str] = dspy.OutputField(
      desc=(
          "Generate a list of strings, each representing a distinct and primary main thought or core idea directly extracted from the input text. "
          "Focus only on the most significant concepts. "
          "Each one should be self-contained: include enough context (key subjects/concepts from the text) to be understood on its own. "
          "To preserve meaning and clarity, incorporate key terminology or impactful phrasing directly from the source text where appropriate. "
      )
  )


# TO-DO: output format check
class FindThoughtsModule(dspy.Module):
    def __init__(self):
        super().__init__()
        self.find_thoughts = dspy.Predict(FindThoughtsSignature)

    def forward(self, text):
        prediction = self.find_thoughts(text=text)
        logger.debug(f"DSPi prediction: {prediction}")
        return prediction.main_thoughts
    

class FindThoughts:
    def __init__(self, text: str, identifiers: str):
        self.text = text
        self.identifiers = identifiers

    def save_to_db(self, texts):
        with get_db_session() as session:
            thoughts_service = ThoughtsService(session)
            source_ids, thought_ids = thoughts_service.add_collection(
                contents=texts,
                source_keys=self.identifiers,
                source_contents=[self.text]
            )

    def find(self):
        """Inference and save to database"""
        finder = FindThoughtsModule()
        thoughts = finder(self.text)
        self.save_to_db(thoughts)
        return thoughts

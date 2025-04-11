"""
Define tasks that this system can handle:
  - type of thoughts (destination data) as task type in key: str
  - type of sources in value: List[str]
"""

from enums import ThoughtType

define_tasks = {
    ThoughtType.note.name: ['book']
}
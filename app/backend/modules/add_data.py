import logging

from utils.notes import extract_book_notes
from modules.thoughts_services import ThoughtsService
from db.session import get_db_session
from enums import ThoughtType

logger = logging.getLogger(__name__)


class AddData:
    def __init__(
        self,
        task: str, 
        source_type: str, 
        source_identifiers: dict, 
        file_content: bytes | None = None, 
        text_list: list[str] | None = None
    ):
        if not file_content and not text_list:
            raise ValueError("File and texts are both empty")
        
        self.task = task
        self.file_content = file_content
        self.text_list = text_list
        self.source_type = source_type
        self.source_identifiers = source_identifiers

        self.source_identifiers['type'] = self.source_type

    def _notes(self):
        if self.source_type != 'book':
            raise NotImplementedError("Only source book supported")
        
        # TO-DO: check file type if html
        # Prioritize file content instead of text list
        if self.file_content:
            self.content = self.file_content.decode()
            self.notes = extract_book_notes(self.content).get('notes')
        else:
            self.notes = self.text_list # TO-DO: value check

        with get_db_session() as session:
            thoughts_service = ThoughtsService(session)
            source_ids, thought_ids = thoughts_service.add_collection(
                contents=self.notes,
                task=ThoughtType.note,
                source_keys=self.source_identifiers,
                source_contents=[], # TO-DO: implement file save
            )

    def run(self):
        if self.task != 'note':
            raise NotImplementedError("Only task note are supplorted at present.")
        self._notes()
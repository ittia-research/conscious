import logging
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

def extract_book_notes(html_string: str):
    """
    Parses HTML export of book notes.
    Extract both highlights and notes as notes.

    Supports:
      - Kindle HTML
    
    Returns: dict of notes or empty dict

    Procedures and reasons:
    Highlights exports might contains sections or headers from the official platform 
    or user added manually, here we do not incoporate such info, only highlight text will be imported, by these reasons:
        - The boundry of these sections and headers are not always clear, 
            thus we can't ensure 100% accuracy when processing automatically.
        - These info does not provides much value in the current system. The effort 
            it takes to reproduce the structure of the source are not matched by their value.
        - We don't intend to use these highlights as replacement of the book, it is always encouraged 
            to re-read the original pages for full review and new insights.
        - The location data are bound to the source, for example EPUB, PDF, etc.. Our system do not 
            intend to incoporate this lower layer of differences, thus these info will mostly be useless in our system.
    """
    # Notes added during reading for custom headers
    note_headers = ['.h1', '.h2', '.h3', '.h4', '.h5', '.h6']
    
    try:
        soup = BeautifulSoup(html_string, 'html.parser')

        title_tag = soup.find('div', class_='bookTitle')
        title = title_tag.get_text(strip=True) if title_tag else ""
        
        authors_tag = soup.find('div', class_='authors')
        authors = authors_tag.get_text(strip=True) if authors_tag else ""

        # --- Extract notes ---
        notes = []
        note_tags = soup.find_all('div', class_='noteText')
        
        for note_tag in note_tags:
            # In Kindle export a note div contains a h3, exclude the h3 content here
            content = note_tag.contents[0]
            notes.append(content)

        """
        Sometimes people highlight a title and add note such as `.h1`, 
          so that the title can be treated as h1 header when import to other system.
        We do not use headers so remove the highlight and note pair here.
        """
        for idx, note in enumerate(notes):
            # Remove highlight of header note
            if idx + 1 < len(notes) and notes[idx + 1] in note_headers:
                notes[idx] = ""
            # Remove header notes themself
            if notes[idx] in note_headers:
                notes[idx] = ""

        # Remove empty
        notes = [n for n in notes if n]
        
        # Remove duplicates while preserving order
        notes = list(dict.fromkeys(notes))

        result_data = {
            "title": title,
            "authors": authors,
            "notes": notes
        }

        return result_data

    except Exception as e:
        logger.error(f"Failed parsing html for highlights: {e}")
        return {}
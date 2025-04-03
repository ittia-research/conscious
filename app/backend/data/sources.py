"""
Source TYPE and their IDENTIFIERS, the `TYPE` is also a IDENTIFIER
For example, books has identifier of `isbn` and type `books``.
The top level keys represent types, each of them contains a dict of keys as extra identifiers.

Identifiers are just properties of the item with utility of identifying a source.

Rules:
  - All keys in lower case.
"""

define_sources = {
    'books': {
        'keys': {
            'isbn': {
                'name': 'ISBN',
                'desc': "International Standard Book Number",
                'examples': [
                    '9781567926859'
                ]
            }
        }
    },
    'website': {
        'keys': {
            'url': {
                'name': 'URL',
                'desc': "Uniform Resource Locator",
                'examples': [
                    'https://www.wikipedia.org'
                ]
            }
        }
    }, 
}
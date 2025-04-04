"""
Source TYPE and their IDENTIFIERS, the `TYPE` is also a IDENTIFIER
For example, book has identifier of `isbn` and type `book`.

Identifiers are just properties of the item with utility of identifying a source.

Key structures:
  - The top level keys represent types, each of them contains a dict of keys as extra identifiers.
  - `required` and `label` are been used to verify data and UI display

Rules:
  - All type in singular form.
  - All keys in lower case.
"""

define_sources = {
    'book': {
        'keys': {
            'isbn': {
                # TO-DO: different ISBN versions; what if book have no ISBN?
                'label': 'ISBN',
                'required': True,
                'desc': "International Standard Book Number",
                'examples': [
                    '9781567926859'
                ],
            },
            'isbn_test': {'label': 'ISBN Test', 'required': False}
        },
        'label': "Book"
    },
    'website': {
        'keys': {
            'url': {
                # TO-DO: can we have a standard approach to sanitize URL? 
                'name': 'URL',
                'required': True,
                'desc': "Uniform Resource Locator",
                'examples': [
                    'https://www.wikipedia.org'
                ]
            }
        },
        'label': 'Website'
    }, 
}
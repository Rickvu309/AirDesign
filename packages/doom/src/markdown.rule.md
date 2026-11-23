# The words an agent reads and writes hold every paragraph a person sees: a blank line between paragraphs paints as an empty paragraph and reads back as one, while a blank line inside one list leaves it one list, as CommonMark reads a loose list

`packages/doom/src/markdown.test.ts` draws texts with empty paragraphs between filled ones and fails when `textFromMarkdown` and `textToMarkdown` do not give back the same text and the same markdown, and fails when a loose bullet, numbered or nested list reads other than its tight form

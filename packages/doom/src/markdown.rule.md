# The words an agent reads and writes hold every paragraph a person sees, so a blank line between paragraphs paints as an empty paragraph and reads back as one

`packages/doom/src/markdown.test.ts` draws texts with empty paragraphs between filled ones and fails when `textFromMarkdown` and `textToMarkdown` do not give back the same text and the same markdown

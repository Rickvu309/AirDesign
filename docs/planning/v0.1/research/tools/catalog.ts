import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const str = { type: 'string' };
const num = { type: 'integer', minimum: 0 };
const id = { type: 'string', minLength: 1, maxLength: 64 };
const obj = (properties: Record<string, object>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const choice = (...values: string[]) => ({ type: 'string', enum: values });
const page = { cursor: str, limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } };
const deck = { deckId: id };
const slide = { ...deck, slideId: id };
const write = { ...deck, baseVersion: num, requestId: id };
const op = { oneOf: [
  obj({ kind: { const: 'insert' }, parentId: id, index: num, jsx: str }),
  obj({ kind: { const: 'set' }, id, properties: { type: 'object', minProperties: 1 } }),
  obj({ kind: { const: 'move' }, id, parentId: id, index: num }),
  obj({ kind: { const: 'remove' }, id })
] };
const error = obj({ code: str, message: str, retryable: { type: 'boolean' }, recovery: str, currentVersion: num }, ['code', 'message', 'retryable', 'recovery']);
const outputSchema = { type: 'object' as const, properties: { ok: { type: 'boolean' }, data: { type: 'object' }, error, omitted: { type: 'array', items: str } }, required: ['ok'], additionalProperties: false };
const tool = (name: string, description: string, properties: Record<string, object>, required: string[], readOnly = true): Tool => ({ name, description, inputSchema: { ...obj(properties, required), type: 'object' }, outputSchema, annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly } });

export const catalog: Tool[] = [
  tool('get_deck', 'Read a versioned deck outline. Page slides; use get_slide for content.', { ...deck, ...page }, ['deckId']),
  tool('get_slide', 'Read a versioned slide or subtree as restricted JSX or canonical JSON. Page complete child nodes.', { ...slide, rootId: id, format: choice('jsx', 'json'), ...page }, ['deckId', 'slideId']),
  tool('get_context', 'Read active deck, selection ids and preferences. Resolve ids before writing.', {}, []),
  tool('get_brand', 'Read allowed fonts, colors, assets and rules for a brand.', { brandId: id }, ['brandId']),
  tool('find_elements', 'Search deck elements by text or kind; return ids, slide ids and snippets.', { ...deck, query: str, kind: choice('text', 'image', 'shape', 'group'), ...page }, ['deckId']),
  tool('list_decks', 'Find owned decks by title; return ids and versions.', { query: str, ...page }, []),
  tool('search_assets', 'Find uploaded, brand or stock assets; return provenance and reusable file ids.', { query: str, source: choice('all', 'brand', 'uploads', 'stock'), ...page }, []),
  tool('read_file', 'Read bounded file metadata or text ranges; return resource links for binaries.', { fileId: id, offset: num, length: { type: 'integer', minimum: 1, maximum: 8000 } }, ['fileId']),
  tool('add_file', 'Register an uploaded file or fetch an allowed HTTPS source. Never inline binary data.', { sourceUrl: { type: 'string', format: 'uri' }, name: str, requestId: id }, ['sourceUrl', 'name', 'requestId'], false),
  tool('export_deck', 'Export a pinned deck version; return a file or operation id.', { ...deck, version: num, format: choice('pptx', 'pdf', 'png'), requestId: id }, ['deckId', 'version', 'format', 'requestId'], false),
  tool('import_deck', 'Import a library file into a new deck; return an operation id and fidelity notes.', { fileId: id, requestId: id }, ['fileId', 'requestId'], false),
  tool('apply_changes', 'Atomically insert, set, move or remove elements and slides. Stale baseVersion changes nothing. requestId deduplicates retries.', { ...write, changes: { type: 'array', minItems: 1, maxItems: 100, items: op } }, ['deckId', 'baseVersion', 'requestId', 'changes'], false),
  tool('create_deck', 'Create an empty deck with an optional brand; return version and deck id.', { title: str, brandId: id, requestId: id }, ['title', 'requestId'], false),
  tool('update_brand', 'Apply explicit brand token changes against a brand version.', { brandId: id, baseVersion: num, requestId: id, tokens: { type: 'object', minProperties: 1 } }, ['brandId', 'baseVersion', 'requestId', 'tokens'], false),
  tool('capture_slide', 'Return one native image block of a pinned slide render and version metadata.', { ...slide, version: num, width: { type: 'integer', minimum: 320, maximum: 1600, default: 1280 }, format: choice('png', 'jpeg') }, ['deckId', 'slideId', 'version']),
  tool('check_deck', 'Check overflow, contrast, brand and PowerPoint fit; return element ids and actionable findings.', { ...deck, version: num, checks: { type: 'array', items: choice('overflow', 'contrast', 'brand', 'pptx') }, ...page }, ['deckId', 'version']),
  tool('get_operation', 'Read import or export status; return pending, ready or failed plus file links.', { operationId: id }, ['operationId']),
  tool('undo_change', 'Undo a named change against the current deck version; refuse conflicting history.', { ...write, changeId: id }, ['deckId', 'baseVersion', 'requestId', 'changeId'], false)
];

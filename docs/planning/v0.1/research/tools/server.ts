import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { catalog } from './catalog.ts';

const server = new Server({ name: 'airdesign-research-stub', version: '0.1.0' }, { capabilities: { tools: {} } });
const supported = new Set(['get_slide', 'apply_changes', 'capture_slide']);
const state = { version: 1, text: 'Hello AirDesign' };
const seen = new Map<string, { fingerprint: string; result: ReturnType<typeof result> }>();
const result = (data: Record<string, unknown>) => wrap({ ok: true, data });
const wrap = (body: Record<string, unknown>, isError = false) => ({ content: [{ type: 'text' as const, text: JSON.stringify(body) }], structuredContent: body, isError });
const failure = (code: string, message: string, recovery: string) => wrap({ ok: false, error: { code, message, retryable: false, recovery, currentVersion: state.version } }, true);
const target = z.object({ deckId: z.literal('d1'), slideId: z.literal('s1') });
const read = target.extend({ format: z.enum(['jsx', 'json']).optional() }).strict();
const capture = target.extend({ version: z.number().int().nonnegative(), width: z.number().int().min(320).max(1600).optional(), format: z.enum(['png', 'jpeg']).optional() }).strict();
const setOp = z.object({ kind: z.literal('set'), id: z.string(), properties: z.object({ text: z.string().max(1000) }).strict() }).strict();
const changes = z.object({ deckId: z.literal('d1'), baseVersion: z.number().int().nonnegative(), requestId: z.string().min(1).max(64), changes: z.array(setOp).min(1).max(100) }).strict();
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('{', '&#123;').replaceAll('}', '&#125;');

const exposed = catalog.filter(t => supported.has(t.name)).map(t => t.name === 'apply_changes' ? {
  ...t,
  description: 'Stub: atomically set text on t1. Refuse a stale baseVersion; deduplicate requestId.',
  inputSchema: { type: 'object' as const, properties: {
    deckId: { const: 'd1' }, baseVersion: { type: 'integer', minimum: 0 }, requestId: { type: 'string', minLength: 1, maxLength: 64 },
    changes: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', properties: {
      kind: { const: 'set' }, id: { type: 'string' }, properties: { type: 'object', properties: { text: { type: 'string', maxLength: 1000 } }, required: ['text'], additionalProperties: false }
    }, required: ['kind', 'id', 'properties'], additionalProperties: false } }
  }, required: ['deckId', 'baseVersion', 'requestId', 'changes'], additionalProperties: false }
} : t.name === 'get_slide' ? { ...t, inputSchema: { type: 'object' as const, properties: { deckId: { const: 'd1' }, slideId: { const: 's1' }, format: { type: 'string', enum: ['jsx', 'json'] } }, required: ['deckId', 'slideId'], additionalProperties: false } } : t.name === 'capture_slide' ? { ...t, description: 'Stub: return a 1x1 PNG transport fixture and version metadata. No slide renderer.' } : t);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: exposed }));
server.setRequestHandler(CallToolRequestSchema, async request => {
  const input = request.params.arguments;
  switch (request.params.name) {
    case 'get_slide': {
      const parsed = read.safeParse(input);
      if (!parsed.success) return failure('INVALID_ARGUMENT', 'Use deck d1 and slide s1.', 'Read the advertised schema.');
      return result({ deckId: 'd1', slideId: 's1', version: state.version, content: parsed.data.format === 'json' ? { id: 't1', kind: 'text', text: state.text } : `<Slide id="s1"><Text id="t1">${escape(state.text)}</Text></Slide>` });
    }
    case 'apply_changes': {
      const parsed = changes.safeParse(input);
      if (!parsed.success) return failure('INVALID_ARGUMENT', 'This stub supports set text only.', 'Use {kind:set,id:t1,properties:{text:string}}.');
      const p = parsed.data;
      const fingerprint = JSON.stringify(p);
      const previous = seen.get(p.requestId);
      if (previous) return previous.fingerprint === fingerprint ? previous.result : failure('REQUEST_ID_REUSED', 'Request id has a different payload.', 'Use a new requestId for a different change.');
      if (p.baseVersion !== state.version) return failure('STALE_VERSION', 'Deck changed since it was read.', 'Call get_slide and rebase the intended edit.');
      if (p.changes.some(c => c.id !== 't1')) return failure('NOT_FOUND', 'Element does not exist. No changes applied.', 'Use the ids returned by get_slide.');
      for (const c of p.changes) state.text = c.properties.text;
      state.version += 1;
      const response = result({ version: state.version, changeId: `c${state.version}`, changedIds: ['t1'] });
      seen.set(p.requestId, { fingerprint, result: response });
      return response;
    }
    case 'capture_slide': {
      const parsed = capture.safeParse(input);
      if (!parsed.success) return failure('INVALID_ARGUMENT', 'Invalid capture request.', 'Use d1, s1 and a version.');
      if (parsed.data.version !== state.version) return failure('STALE_VERSION', 'Requested render version is unavailable.', 'Read get_slide for the current version.');
      const response = result({ version: state.version, width: 1, height: 1, fixture: true, note: 'Transport fixture only; no slide renderer is implemented.' });
      return { ...response, content: [...response.content, { type: 'image' as const, mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' }] };
    }
    default: return failure('UNKNOWN_TOOL', 'Tool is not implemented in this stub.', 'Call tools/list.');
  }
});
await server.connect(new StdioServerTransport());

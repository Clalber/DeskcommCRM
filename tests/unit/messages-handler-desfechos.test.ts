/**
 * Task 4a do seam de canais — rede de caracterização do caminho de envio.
 *
 * Fixa os 6 desfechos que `sendMessageHandler` produz DEPOIS de inserir a linha
 * (`_handler.ts:219-318`), escrita contra o código ATUAL, antes de qualquer
 * refactor. As Tasks 4b–4d trocam `getWahaClient`/`resolveWahaChatId`/`sendMedia`
 * por `ChannelAdapter` — por isso aqui se asserta o **estado final da linha de
 * mensagem**, nunca a sequência de chamadas internas: teste que asserta chamada
 * travaria exatamente o refactor que ele deveria proteger.
 *
 * Fake próprio de propósito: `tests/invariants/automation-send-whatsapp.test.ts`
 * é o único outro teste que exercita este handler, mas arrasta `gov-helpers` e
 * exige Postgres real — e a pasta `tests/invariants/` está fora do `test:unit` e
 * do CI. Duplicar scaffolding é o preço de uma rede que gateia PR em segundos.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendMessageHandler } from '@/app/api/v1/messages/_handler';
import type { HandlerCtx } from '@/lib/api/handlers/types';
import type { SendMessageInput } from '@/lib/schemas';

const ORG = '11111111-1111-4111-8111-111111111111';
const CONV = '22222222-2222-4222-8222-222222222222';
const CONTACT = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';
const USER = '55555555-5555-4555-8555-555555555555';
const WAHA_BASE = 'http://localhost:3030';

// A URL assinada do Storage é montada com o admin client; ele valida env no
// import, e o desfecho de mídia precisa controlar sucesso E falha da assinatura.
const signedUrl = vi.fn<() => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>>(
  async () => ({ data: { signedUrl: 'https://signed.example/a.jpg' }, error: null }),
);
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ storage: { from: () => ({ createSignedUrl: signedUrl }) } }),
}));
// Audit é fire-and-forget e escreve em outra tabela; fora do escopo dos desfechos.
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }));

type Row = Record<string, unknown>;

interface ConversationShape {
  isGroup?: boolean;
  groupChatId?: string | null;
  phoneNumber?: string | null;
  waIdentity?: string | null;
  isBlocked?: boolean;
  sessionStatus?: string | null;
}

function conversationRow(shape: ConversationShape = {}): Row {
  return {
    id: CONV,
    organization_id: ORG,
    contact_id: CONTACT,
    channel_session_id: SESSION,
    is_group: shape.isGroup ?? false,
    group_chat_id: shape.groupChatId ?? null,
    contacts: {
      phone_number: shape.phoneNumber === undefined ? '+5531999998888' : shape.phoneNumber,
      wa_identity: shape.waIdentity ?? null,
      is_blocked: shape.isBlocked ?? false,
    },
    channel_sessions:
      shape.sessionStatus === null
        ? null
        : { waha_session_name: 'default', status: shape.sessionStatus ?? 'WORKING' },
  };
}

/**
 * Fake de `SupabaseClient` com o mínimo que o handler encadeia:
 *   conversations: select().eq().maybeSingle() · update().eq()
 *   messages:      insert().select().single() · update().eq().select().maybeSingle()
 *   rpc('emit_event')
 * O update é merge raso — igual ao que o Postgres faz com um SET de colunas.
 */
function makeSupabase(conversation: Row) {
  const state: { message: Row | null } = { message: null };

  const client = {
    from(table: string) {
      if (table === 'conversations') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: conversation, error: null }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === 'messages') {
        return {
          insert: (row: Row) => {
            state.message = {
              id: 'msg-1',
              external_id: null,
              ack: null,
              error_code: null,
              error_message: null,
              ...row,
            };
            return { select: () => ({ single: async () => ({ data: { ...state.message }, error: null }) }) };
          },
          update: (patch: Row) => {
            state.message = { ...state.message, ...patch };
            return {
              eq: () => ({
                select: () => ({ maybeSingle: async () => ({ data: { ...state.message }, error: null }) }),
              }),
            };
          },
        };
      }
      throw new Error(`fake_supabase: tabela inesperada '${table}'`);
    },
    rpc: async () => ({ error: null }),
  };

  return client as unknown as SupabaseClient;
}

const ctx: HandlerCtx = { organization_id: ORG, actor: { type: 'user', id: USER }, requestId: 'req-1' };

function textInput(over: Partial<SendMessageInput> = {}): SendMessageInput {
  return { conversation_id: CONV, type: 'text', body: 'oi', ...over } as SendMessageInput;
}

function wahaConfigured(configured: boolean) {
  vi.stubEnv('WAHA_API_BASE_URL', configured ? WAHA_BASE : '');
  vi.stubEnv('WAHA_API_KEY', configured ? 'hash123' : '');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  signedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/a.jpg' }, error: null });
});

describe('sendMessageHandler — os 6 desfechos do envio', () => {
  it('1. WAHA não configurado: fica queued com queued_reason, nada sai pela rede', async () => {
    wahaConfigured(false);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const msg = await sendMessageHandler(makeSupabase(conversationRow()), ctx, textInput());

    expect(msg.status).toBe('queued');
    expect((msg.metadata as Record<string, unknown>).queued_reason).toBe('waha_not_configured');
    expect(msg.error_code).toBeNull();
    expect(msg.external_id).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('2. sem destinatário resolvível: failed/missing_phone_number', async () => {
    wahaConfigured(true);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const msg = await sendMessageHandler(
      makeSupabase(conversationRow({ phoneNumber: null, waIdentity: null })),
      ctx,
      textInput(),
    );

    expect(msg.status).toBe('failed');
    expect(msg.error_code).toBe('missing_phone_number');
    expect(msg.error_message).toBe('Contato sem telefone para envio WhatsApp.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('3. sessão fora de WORKING: fica queued com channel_session_not_working', async () => {
    wahaConfigured(true);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const msg = await sendMessageHandler(
      makeSupabase(conversationRow({ sessionStatus: 'SCAN_QR_CODE' })),
      ctx,
      textInput(),
    );

    expect(msg.status).toBe('queued');
    expect((msg.metadata as Record<string, unknown>).queued_reason).toBe('channel_session_not_working');
    expect(msg.error_code).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Os desfechos 4 e 5 gravam a MESMA linha final. O que os separa é o efeito
  // externo — por qual endpoint a mensagem saiu. Isso não é "sequência de
  // chamadas internas": é o que de fato deixa o processo, e o refactor das
  // Tasks 4b–4d tem que preservá-lo (o adapter WAHA fala com o mesmo WAHA).
  it('4. com media_storage_path: sent + external_id + ack 0, pelo endpoint de mídia', async () => {
    wahaConfigured(true);
    const fetchMock = vi.fn(async (..._args: unknown[]) => Response.json({ id: { _serialized: 'MEDIA1' } }));
    vi.stubGlobal('fetch', fetchMock);

    const msg = await sendMessageHandler(
      makeSupabase(conversationRow()),
      ctx,
      textInput({ type: 'image', body: undefined, media_storage_path: `${ORG}/${CONV}/a.jpg`, media_mime: 'image/jpeg' }),
    );

    expect(msg.status).toBe('sent');
    expect(msg.external_id).toBe('MEDIA1');
    expect(msg.ack).toBe(0);
    expect(msg.error_code).toBeNull();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${WAHA_BASE}/api/sendImage`);
  });

  it('5. texto puro: sent + external_id + ack 0, pelo endpoint de texto', async () => {
    wahaConfigured(true);
    const fetchMock = vi.fn(async (..._args: unknown[]) => Response.json({ key: { id: 'TEXT1' } }));
    vi.stubGlobal('fetch', fetchMock);

    const msg = await sendMessageHandler(makeSupabase(conversationRow()), ctx, textInput());

    expect(msg.status).toBe('sent');
    expect(msg.external_id).toBe('TEXT1');
    expect(msg.ack).toBe(0);
    expect(msg.error_code).toBeNull();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${WAHA_BASE}/api/sendText`);
  });

  it('6. envio lança: failed/waha_error com a mensagem do erro', async () => {
    wahaConfigured(true);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));

    const msg = await sendMessageHandler(makeSupabase(conversationRow()), ctx, textInput());

    expect(msg.status).toBe('failed');
    expect(msg.error_code).toBe('waha_error');
    expect(msg.error_message).toBe('waha_500');
    expect(msg.external_id).toBeNull();
  });

  it('6b. assinatura do Storage falha: failed/storage_sign_failed, não waha_error', async () => {
    wahaConfigured(true);
    signedUrl.mockResolvedValue({ data: null, error: { message: 'no_object' } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const msg = await sendMessageHandler(
      makeSupabase(conversationRow()),
      ctx,
      textInput({ type: 'image', body: undefined, media_storage_path: `${ORG}/${CONV}/a.jpg`, media_mime: 'image/jpeg' }),
    );

    expect(msg.status).toBe('failed');
    expect(msg.error_code).toBe('storage_sign_failed');
    expect(msg.error_message).toContain('no_object');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // A ORDEM entre os desfechos é comportamento, não detalhe: se o pre-check de
  // configuração descer para depois da resolução do destinatário, uma instalação
  // sem WAHA passa a marcar a mensagem como `failed` em vez de deixá-la em fila.
  it('ordem: sem WAHA E sem telefone → waha_not_configured, nunca missing_phone_number', async () => {
    wahaConfigured(false);
    vi.stubGlobal('fetch', vi.fn());

    const msg = await sendMessageHandler(
      makeSupabase(conversationRow({ phoneNumber: null, waIdentity: null })),
      ctx,
      textInput(),
    );

    expect(msg.status).toBe('queued');
    expect((msg.metadata as Record<string, unknown>).queued_reason).toBe('waha_not_configured');
    expect(msg.error_code).toBeNull();
  });
});

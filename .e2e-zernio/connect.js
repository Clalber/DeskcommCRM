// crm/lib/channels/archived.ts
var ARCHIVED_AT = "archived_at";
var COLUNA_AUSENTE = /* @__PURE__ */ new Set(["42703", "PGRST204"]);
function isArchivedColumnMissing(error) {
  if (!error) return false;
  return COLUNA_AUSENTE.has(error.code ?? "") && (error.message ?? "").includes(ARCHIVED_AT);
}
async function queryTolerantToMissingArchived(withArchived, withoutArchived) {
  const first = await withArchived();
  if (!isArchivedColumnMissing(first.error)) return { ...first, schemaOutdated: false };
  const fallback = await withoutArchived();
  return { ...fallback, schemaOutdated: true };
}

// crm/lib/channels/capabilities.ts
var CHANNEL_PROVIDER_ZERNIO = "zernio";

// crm/lib/channels/zernio/credentials.ts
function zernioBaseUrl() {
  return process.env.ZERNIO_API_BASE_URL ?? "https://zernio.com/api";
}

// crm/lib/channels/connect.ts
var PARTNER_CHANNEL_PROVIDER = CHANNEL_PROVIDER_ZERNIO;
var PARTNER_CHANNEL_LABEL = "Zernio";
async function validatePartnerCredentials(input) {
  const accountId = input.accountId.trim();
  const apiKey = input.apiKey.trim();
  if (!accountId || !apiKey) return { ok: false, reason: "Informe a conta e a chave." };
  let res;
  try {
    res = await fetch(`${zernioBaseUrl()}/v1/accounts`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
  } catch {
    return { ok: false, reason: "N\xE3o foi poss\xEDvel falar com o provedor. Tente de novo." };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: "Chave recusada pelo provedor." };
  }
  if (!res.ok) {
    return { ok: false, reason: `Provedor respondeu ${res.status}.` };
  }
  const json = await res.json().catch(() => null);
  const contas = Array.isArray(json?.accounts) ? json.accounts : [];
  const conta = contas.find((c) => String(c._id ?? c.id) === accountId) ?? null;
  if (!conta) {
    return { ok: false, reason: "Conta n\xE3o encontrada para esta chave." };
  }
  if (conta.platform !== "whatsapp") {
    return {
      ok: false,
      reason: `Esta conta \xE9 de ${String(conta.platform ?? "outra rede")}, n\xE3o de WhatsApp.`
    };
  }
  const meta = conta.metadata ?? {};
  return {
    ok: true,
    phoneNumber: typeof meta.displayPhoneNumber === "string" ? meta.displayPhoneNumber : null,
    displayName: typeof conta.displayName === "string" ? conta.displayName : null,
    qualityRating: typeof meta.qualityRating === "string" ? meta.qualityRating : null
  };
}
var COLUNAS = "id, zernio_account_id, phone_number, display_name, status, webhook_path_token, zernio_token_encrypted";
function toPartnerSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountId: row.zernio_account_id ?? null,
    phoneNumber: row.phone_number ?? null,
    displayName: row.display_name ?? null,
    status: row.status ?? null,
    webhookPathToken: row.webhook_path_token ?? null,
    hasApiKey: !!row.zernio_token_encrypted,
    archivedAt: row.archived_at ?? null
  };
}
async function findPartnerSession(admin, organizationId) {
  const buscar = (colunas) => admin.from("channel_sessions").select(colunas).eq("organization_id", organizationId).eq("provider", PARTNER_CHANNEL_PROVIDER).maybeSingle();
  const { data } = await queryTolerantToMissingArchived(
    () => buscar(`${COLUNAS}, ${ARCHIVED_AT}`),
    () => buscar(COLUNAS)
  );
  return toPartnerSession(data);
}
async function savePartnerSession(admin, input) {
  const linha = {
    organization_id: input.organizationId,
    provider: PARTNER_CHANNEL_PROVIDER,
    zernio_account_id: input.accountId,
    zernio_token_encrypted: input.apiKeyEncrypted,
    webhook_path_token: input.webhookPathToken,
    webhook_secret_encrypted: input.webhookSecretEncrypted,
    phone_number: input.phoneNumber,
    display_name: input.displayName,
    status: "WORKING",
    archived_at: null
  };
  const { error } = input.existingId ? await admin.from("channel_sessions").update(linha).eq("id", input.existingId) : await admin.from("channel_sessions").insert(linha);
  return { error: error?.message ?? null };
}
export {
  PARTNER_CHANNEL_LABEL,
  PARTNER_CHANNEL_PROVIDER,
  findPartnerSession,
  savePartnerSession,
  validatePartnerCredentials
};

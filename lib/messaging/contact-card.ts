/**
 * Cartão de contato compartilhado no WhatsApp (vcard).
 * Usado na saída (montar payload WAHA) e na entrada (parse do body).
 */

export interface SharedContact {
  contact_id?: string;
  name: string;
  phone_number: string;
}

const VCARD_FN = /^FN:(.+)$/m;
const VCARD_TEL = /^TEL[^:]*:(.+)$/m;

/** Extrai nome e telefone de um vCard em texto (mensagem inbound). */
export function parseVcard(body: string | null | undefined): SharedContact | null {
  if (!body?.includes("BEGIN:VCARD")) return null;
  const name = body.match(VCARD_FN)?.[1]?.trim() ?? null;
  const telRaw = body.match(VCARD_TEL)?.[1]?.trim() ?? null;
  if (!name && !telRaw) return null;
  const phone = telRaw ? normalizePhoneForDisplay(telRaw) : "";
  if (!name && !phone) return null;
  return { name: name ?? phone, phone_number: phone || telRaw! };
}

/** Lê o contato que nós mesmos gravamos em metadata ao enviar. */
export function sharedContactFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): SharedContact | null {
  const raw = metadata?.shared_contact;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const phone = typeof o.phone_number === "string" ? o.phone_number.trim() : "";
  if (!name && !phone) return null;
  return {
    contact_id: typeof o.contact_id === "string" ? o.contact_id : undefined,
    name: name || phone,
    phone_number: phone,
  };
}

/** Resolve o contato exibível: metadata (outbound) → parse vcard (inbound) → body como nome. */
export function resolveSharedContact(
  message: { type: string; body: string | null; metadata: Record<string, unknown> },
): SharedContact | null {
  if (message.type !== "contact") return null;
  const fromMeta = sharedContactFromMetadata(message.metadata);
  if (fromMeta) return fromMeta;
  const fromVcard = parseVcard(message.body);
  if (fromVcard) return fromVcard;
  if (message.body?.trim()) {
    return { name: message.body.trim(), phone_number: "" };
  }
  return null;
}

/** Extrai telefone discável (E.164 com +) de texto livre; null se inválido. */
export function parseDialablePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = phoneToWhatsappId(trimmed);
  if (digits.length < 8 || digits.length > 15) return null;
  return normalizePhoneForDisplay(trimmed.startsWith("+") ? trimmed : `+${digits}`);
}

/** Só dígitos — whatsappId do WAHA / wa_id da Meta. */
export function phoneToWhatsappId(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Exibição legível; preserva + quando já E.164. */
export function normalizePhoneForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = phoneToWhatsappId(trimmed);
  return digits.length >= 8 ? `+${digits}` : trimmed;
}

/** Monta vCard mínimo aceito pelo WAHA sendContactVcard. */
export function buildVcard(name: string, phone: string, whatsappId?: string): string {
  const waid = whatsappId ?? phoneToWhatsappId(normalizePhoneForDisplay(phone));
  const telDisplay = whatsappId ? `+${waid}` : normalizePhoneForDisplay(phone);
  const safeName = name.replace(/\n/g, " ").trim() || telDisplay;
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${safeName}`,
    `TEL;type=CELL;type=VOICE;waid=${waid}:${telDisplay}`,
    "END:VCARD",
  ].join("\n");
}

/** Payload de um contato para POST /api/sendContactVcard. */
export function wahaContactPayload(name: string, phone: string, whatsappId?: string) {
  const waid = whatsappId ?? phoneToWhatsappId(normalizePhoneForDisplay(phone));
  const telDisplay = whatsappId ? `+${waid}` : normalizePhoneForDisplay(phone);
  const safeName = name.replace(/\n/g, " ").trim() || telDisplay;
  return {
    fullName: safeName,
    phoneNumber: telDisplay,
    whatsappId: waid,
    vcard: buildVcard(safeName, telDisplay, waid),
  };
}

/** Cartão de contato no formato da WhatsApp Cloud API (`type: "contacts"`). */
export function metaContactsPayload(name: string, phone: string) {
  const display = normalizePhoneForDisplay(phone);
  const waid = phoneToWhatsappId(display);
  const safeName = name.replace(/\n/g, " ").trim() || display;
  const sp = safeName.indexOf(" ");
  const firstName = sp > 0 ? safeName.slice(0, sp) : safeName;
  const lastName = sp > 0 ? safeName.slice(sp + 1).trim() : undefined;
  return [
    {
      name: {
        formatted_name: safeName,
        first_name: firstName,
        ...(lastName ? { last_name: lastName } : {}),
      },
      phones: [{ phone: display, type: "CELL", wa_id: waid }],
    },
  ];
}

/** Extrai o primeiro contato de um payload inbound da Meta (`type: "contacts"`). */
export function parseMetaInboundContact(raw: Record<string, unknown>): SharedContact | null {
  const arr = raw.contacts;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const first = arr[0];
  if (!first || typeof first !== "object") return null;
  const o = first as Record<string, unknown>;
  const nameObj = o.name;
  const formatted =
    nameObj && typeof nameObj === "object"
      ? (
          (nameObj as Record<string, unknown>).formatted_name ??
          (nameObj as Record<string, unknown>).first_name
        )
      : null;
  const safeName = typeof formatted === "string" ? formatted.trim() : "";
  const phones = Array.isArray(o.phones) ? o.phones : [];
  const phoneEntry = phones[0];
  let phone = "";
  if (phoneEntry && typeof phoneEntry === "object") {
    const p = phoneEntry as Record<string, unknown>;
    if (typeof p.phone === "string" && p.phone.trim()) {
      phone = normalizePhoneForDisplay(p.phone.trim());
    } else if (typeof p.wa_id === "string" && p.wa_id.trim()) {
      phone = normalizePhoneForDisplay(p.wa_id.trim());
    }
  }
  if (!safeName && !phone) return null;
  return { name: safeName || phone, phone_number: phone };
}

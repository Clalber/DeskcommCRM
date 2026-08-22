/**
 * Parser de CSV para importação de contatos — RFC 4180, zero dependências.
 *
 * Por que não `papaparse`/`xlsx`: o repo não tinha NENhuma lib de planilha e a
 * importação é de CSV mesmo (XLSX exigiria SheetJS inteiro por um recurso que
 * todo Excel exporta como CSV). Parser próprio, pequeno e testado, evita
 * dependência transitiva nova numa instalação self-host.
 *
 * Escopo deliberado: só CSV. XLSX é recusado na borda (rota) com mensagem que
 * ensina a exportar como CSV — recusa abata melhor que meia-parse.
 */

/** Máximo defensivo: arquivo maior que isso é recusado antes do parse. */
export const CSV_MAX_BYTES = 5 * 1024 * 1024;

/** Teto de linhas de dados por importação (protege o round-trip do handler). */
export const CSV_MAX_DATA_ROWS = 500;

const DELIMITERS = [",", ";", "\t"] as const;

/**
 * Parseia CSV RFC 4180: campos entre aspas com vírgula/quebra dentro, aspas
 * escapadas como "", separadores CRLF, CR ou LF. BOM UTF-8 é removido.
 * Delimitador detectado na primeira linha (fora de aspas) entre vírgula,
 * ponto-e-vírgula e tabulação — Excel pt-BR exporta com ";".
 */
export function parseCsv(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Última linha sem quebra final ainda precisa entrar.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\r|\n/, 1)[0] ?? "";
  let best: string = DELIMITERS[0];
  let bestCount = -1;
  for (const d of DELIMITERS) {
    // Conta apenas fora de aspas — vírgula dentro de "Silva, Maria" não é delimitador.
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count += 1;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Cabeçalho → campo canônico
// ---------------------------------------------------------------------------

/**
 * Aceita apelidos pt-BR/en porque a planilha é feita por humano: quem importa
 * tem "Telefone" no Excel, não "phone_number". Acento/caixa/separador são
 * normalizados ("Data de Nascimento" → data_de_nascimento).
 */
const HEADER_ALIASES: Record<string, readonly string[]> = {
  name: ["name", "nome", "cliente"],
  display_name: ["display_name", "apelido", "nome_de_exibicao"],
  email: ["email", "e_mail"],
  phone_number: ["phone_number", "telefone", "whatsapp", "celular", "fone"],
  cpf: ["cpf"],
  birthdate: ["birthdate", "nascimento", "data_de_nascimento", "aniversario"],
  tags: ["tags", "etiquetas", "grupos"],
};

function normalizaHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Mapeia a linha de cabeçalho para os índices dos campos canônicos.
 * Retorna null com o motivo quando o cabeçalho não traz NENHUM identificador
 * (telefone/e-mail) — sem isso nada importável existe, e falhar aberto é
 * melhor que criar 300 contatos vazios.
 */
export function mapHeader(header: string[]): { indices: Record<string, number>; motivo: string | null } {
  const indices: Record<string, number> = {};
  header.forEach((rawCell, idx) => {
    const cell = normalizaHeader(rawCell);
    for (const [campo, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(cell) && indices[campo] === undefined) {
        indices[campo] = idx;
        break;
      }
    }
  });
  const temIdentificador = indices.phone_number !== undefined || indices.email !== undefined;
  return {
    indices,
    motivo: temIdentificador ? null : "cabeçalho sem coluna de telefone nem e-mail",
  };
}

// ---------------------------------------------------------------------------
// Normalização de valor por campo
// ---------------------------------------------------------------------------

export interface LinhaNormalizada {
  name?: string;
  display_name?: string;
  email?: string;
  phone_number?: string;
  cpf?: string;
  birthdate?: string;
  tags?: string[];
}

/**
 * Telephone → E.164 (`+` + 8–15 dígitos). Regra igual à de cima da API:
 * aceita "+55 11 99999-8888", "(11) 99999-8888", "5511999998888".
 * Sem DDI explícito e com comprimento plausível, assume que os dígitos já são
 * E.164 sem o "+" — nunca inventa DDI do país, porque chute errado aqui vira
 * mensagem para pessoa errada.
 */
export function normalizaTelefone(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const temDdi = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (temDdi) {
    return /^\+\d{8,15}$/.test(`+${digits}`) && digits.length >= 8 && digits.length <= 15
      ? `+${digits}`
      : null;
  }
  return digits.length >= 10 && digits.length <= 13 ? `+${digits}` : null;
}

/** Data → ISO `YYYY-MM-DD`. Aceita ISO nativo e BR `DD/MM/YYYY` (o do Excel). */
export function normalizaData(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) return t;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/**
 * Converte UMA linha de dados (já mapeada pelo mapHeader) nos campos de contato.
 * Campos ausentes ficam undefined; valores inválidos geram erro nominal — a linha
 * é pulada, as demais seguem. `linha` é 1-based já contando o cabeçalho, para
 * bater com o que o usuário vê no editor.
 */
export function mapLinha(
  cells: string[],
  indices: Record<string, number>,
): { contato: LinhaNormalizada; motivo: string | null } {
  const get = (campo: string): string => {
    const idx = indices[campo];
    return idx === undefined ? "" : (cells[idx] ?? "").trim();
  };

  const contato: LinhaNormalizada = {};

  const name = get("name");
  if (name !== "") contato.name = name.slice(0, 200);
  const displayName = get("display_name");
  if (displayName !== "") contato.display_name = displayName.slice(0, 200);

  const email = get("email");
  if (email !== "") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { contato: {}, motivo: `e-mail inválido: "${email}"` };
    }
    contato.email = email;
  }

  const phoneRaw = get("phone_number");
  if (phoneRaw !== "") {
    const phone = normalizaTelefone(phoneRaw);
    if (phone === null) {
      return {
        contato: {},
        motivo: `telefone inválido: "${phoneRaw}" (use DDI+DDD+número, ex.: +5511999998888)`,
      };
    }
    contato.phone_number = phone;
  }

  if (contato.phone_number === undefined && contato.email === undefined) {
    return { contato: {}, motivo: "linha sem telefone nem e-mail" };
  }

  const cpf = get("cpf").replace(/\D/g, "");
  if (cpf !== "") contato.cpf = cpf;

  const birthdateRaw = get("birthdate");
  if (birthdateRaw !== "") {
    const birthdate = normalizaData(birthdateRaw);
    if (birthdate === null) {
      return {
        contato: {},
        motivo: `data de nascimento inválida: "${birthdateRaw}" (use AAAA-MM-DD ou DD/MM/AAAA)`,
      };
    }
    contato.birthdate = birthdate;
  }

  const tagsRaw = get("tags");
  if (tagsRaw !== "") {
    const tags = tagsRaw
      .split(/[;|]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (tags.length > 0) contato.tags = tags;
  }

  return { contato, motivo: null };
}

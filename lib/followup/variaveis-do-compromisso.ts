/**
 * As variáveis do compromisso dentro do texto fixo de um nó de ação.
 *
 * O nó `action` em `mode:'text'` mandava o corpo cru: o `engine.ts` só trocava
 * `{{volta}}`/`{{voltas}}`. Para um lembrete isso não serve — "sua reunião é
 * hoje às 14h" só existe se a hora vier do banco, e um lembrete que não diz a
 * hora não é lembrete, é ruído.
 *
 * ## Nada de vocabulário novo (doutrina DIRC — Referenciar antes de Duplicar)
 *
 * `{{agendamento.data}}`, `{{agendamento.hora}}`, `{{agendamento.tipo}}` e
 * `{{nome}}` são as MESMAS que as automações já entendem
 * (`lib/automation/engine.ts` monta o contexto, `lib/automation/template.ts`
 * resolve). Quem aprendeu a escrever a mensagem de uma regra não reaprende nada
 * aqui, e o dia em que uma variável nova entrar lá ela entra nos dois lugares.
 *
 * ## ⚠️ `{{agendamento.profissional}}` NÃO FUNCIONA EM MENSAGEM AO CLIENTE
 *
 * E não é defeito: `renderTemplate` tem uma fronteira interno/cliente, e o nome
 * de quem atende está do lado INTERNO junto com `notas` e `qualificacao.*`
 * (`INTERNAL_PREFIXES`). Numa mensagem ao cliente ele resolve para vazio — em
 * silêncio, que é o modo de falha caro: o operador escreve "reunião com
 * {{agendamento.profissional}}", testa nada, e o cliente recebe "reunião com ".
 *
 * Por isso existe `{{agendamento.com_quem}}`: MESMO valor, endereço declarado
 * como público. A fronteira não foi afrouxada — quem escreve `com_quem` está
 * dizendo que quer aquele nome na mensagem, e essa é a diferença entre um
 * vazamento e uma escolha. `profissional` continua bloqueado onde sempre esteve.
 *
 * ## Custo: uma leitura, e só quando há o que trocar
 *
 * `precisaResolver` corta fora todo texto sem `{{` antes de qualquer ida ao
 * banco. Fluxo que não usa variável nenhuma — que é a maioria — não paga nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { partesNoFuso } from "@/lib/agenda/fuso";
import { renderTemplate } from "@/lib/automation/template";
import { rotuloLocal } from "@/lib/tempo/agora";
import { fusoValido, FUSO_PADRAO } from "@/lib/tempo/fusos";

/**
 * O texto pede ALGUMA das chaves que este módulo sabe resolver?
 *
 * ⚠️ NÃO É `texto.includes("{{")`, e a diferença é uma regressão em fluxo alheio.
 *
 * `renderTemplate` apaga TODA chave que não resolve — é a semântica correta dele
 * (mensagem de automação não pode vazar `{{campo.xpto}}` para o cliente). Mas
 * aplicá-lo a qualquer texto com chave mudaria fluxos JÁ PUBLICADOS que não
 * pediram nada disto: um corpo com `{{volta}}` fora de um laço sai hoje com a
 * chave literal (`interpolarVolta` devolve o texto intacto quando não há
 * repetição), e passaria a sair vazio. Ninguém pediu essa mudança, e ela chegaria
 * calada na conversa de um cliente.
 *
 * Com o gatilho estreito, o alcance é só quem OPTA por uma chave deste
 * vocabulário. Dentro de um texto assim, a regra de apagar o desconhecido volta a
 * valer — é a mesma que as automações já aplicam, e quem escreveu `{{nome}}` está
 * no contrato delas.
 */
const CHAVES_QUE_RESOLVEMOS = /\{\{\s*(nome|contact\.name|agendamento\.[a-z_]+)\s*\}\}/;

export function precisaResolver(texto: string): boolean {
  return CHAVES_QUE_RESOLVEMOS.test(texto);
}

/** O que a mensagem ao cliente pode dizer sobre o compromisso. */
export interface ContextoDoCompromisso {
  titulo: string;
  tipo: string;
  data: string;
  hora: string;
  quando: string;
  com_quem: string;
}

const dois = (n: number): string => String(n).padStart(2, "0");

/**
 * Formata a hora combinada NO FUSO DO COMPROMISSO, não no do servidor.
 *
 * `calendar_appointments.time_zone` existe porque a hora que importa é a que a
 * pessoa vai olhar no relógio dela. Um lembrete formatado em UTC diria "17:00"
 * para uma reunião das 14h em São Paulo — e o cliente que confia na mensagem
 * perde a hora.
 */
export function contextoDoCompromisso(input: {
  titulo: string;
  tipoNome: string | null;
  startsAt: string;
  timeZone: string | null;
  donoNome: string | null;
}): ContextoDoCompromisso {
  const fuso = input.timeZone && fusoValido(input.timeZone) ? input.timeZone : FUSO_PADRAO;
  const dt = new Date(input.startsAt);
  const p = partesNoFuso(dt, fuso);
  return {
    titulo: input.titulo,
    tipo: input.tipoNome ?? input.titulo,
    data: `${dois(p.dia)}/${dois(p.mes)}/${p.ano}`,
    hora: `${dois(p.hora)}:${dois(p.minuto)}`,
    quando: rotuloLocal(dt, fuso),
    com_quem: input.donoNome ?? "nossa equipe",
  };
}

/** Troca as chaves do texto pelo que está no banco. Texto sem `{{` volta intacto. */
export function renderizarTextoDoFollowup(
  texto: string,
  contexto: { nomeDoContato: string | null; agendamento: ContextoDoCompromisso | null },
): string {
  return renderTemplate(
    texto,
    {
      contact: { name: contexto.nomeDoContato ?? "" },
      ...(contexto.agendamento ? { agendamento: contexto.agendamento } : {}),
    },
    // A mesma audiência das mensagens de automação: é o guarda que impede
    // `{{qualificacao.orcamento}}` de chegar ao cliente por descuido de quem
    // escreveu o fluxo.
    { audience: "customer" },
  );
}

/**
 * O resolvedor que o cron injeta no tick. Devolve o texto pronto para enviar.
 *
 * ⚠️ QUALQUER FALHA AQUI DEVOLVE O TEXTO CRU, nunca lança. Este resolvedor roda
 * no meio do tick do motor, entre o `insertEnrollmentEvent` e o `enqueueJob`:
 * um throw abortaria o passo de um acompanhamento que já gravou o evento dele —
 * trocaria "a mensagem foi com um buraco no lugar da hora" por "o fluxo parou".
 * Entre os dois, o buraco é o que o operador vê e conserta.
 */
export function criarResolvedorDeTexto(
  admin: SupabaseClient,
): (orgId: string, contactId: string, texto: string) => Promise<string> {
  return async (orgId, contactId, texto) => {
    if (!precisaResolver(texto)) return texto;
    try {
      const [nomeDoContato, agendamento] = await Promise.all([
        carregarNomeDoContato(admin, orgId, contactId),
        carregarProximoCompromisso(admin, orgId, contactId),
      ]);
      return renderizarTextoDoFollowup(texto, { nomeDoContato, agendamento });
    } catch {
      return texto;
    }
  };
}

async function carregarNomeDoContato(
  admin: SupabaseClient,
  orgId: string,
  contactId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("contacts")
    .select("name")
    .eq("organization_id", orgId)
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const nome = data?.name;
  return typeof nome === "string" && nome.trim().length > 0 ? nome : null;
}

/**
 * O PRÓXIMO compromisso vivo do contato — a mesma consulta que
 * `lib/automation/engine.ts` faz para montar `context.agendamento`.
 *
 * A folga de 10 minutos para trás é de lá e é deliberada: o compromisso que
 * acabou de começar ainda é "o de agora" para quem está falando dele. Para o
 * lembrete, que sai com a antecedência do gatilho, esta consulta devolve
 * exatamente o compromisso que abriu o acompanhamento.
 */
async function carregarProximoCompromisso(
  admin: SupabaseClient,
  orgId: string,
  contactId: string,
): Promise<ContextoDoCompromisso | null> {
  const folga = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("calendar_appointments")
    .select("title, starts_at, time_zone, owner_user_id, calendar_event_types:event_type_id(name)")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", folga)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as {
    title: string;
    starts_at: string;
    time_zone: string | null;
    owner_user_id: string | null;
    calendar_event_types: { name: string | null } | null;
  };

  let donoNome: string | null = null;
  if (row.owner_user_id) {
    const { data: userRes } = await admin.auth.admin.getUserById(row.owner_user_id);
    const fullName = userRes?.user?.user_metadata?.full_name;
    donoNome = typeof fullName === "string" && fullName.trim().length > 0 ? fullName : null;
  }

  return contextoDoCompromisso({
    titulo: row.title,
    tipoNome: row.calendar_event_types?.name ?? null,
    startsAt: row.starts_at,
    timeZone: row.time_zone,
    donoNome,
  });
}

// Optional LLM deliberation layer on top of the deterministic engine.
// Design contract (per product spec):
//   1. The numeric backbone stays rule-based — ratings, stances, vetoes,
//      allocation and synthesis are NEVER touched by the LLM. Auditable math.
//   2. The LLM only deepens qualitative text: per-persona summary, one extra
//      insight argument, and the cross-examination challenge.
//   3. Evidence-only: the model sees nothing but the Evidence table and the
//      rule engine's own output. Every evidence id it cites is validated
//      against the table; unknown ids are dropped and uncited claims are
//      marked isInference — same rules as human-written engine text.
//   4. No ANTHROPIC_API_KEY, or any API failure → the deterministic output
//      is returned unchanged. The LLM is an enhancement, never a dependency.
import Anthropic from "@anthropic-ai/sdk";
import type { AssetInfo, Evidence, PersonaId, PersonaOpinion } from "@/lib/types";
import { L, l } from "@/lib/i18n";
import { PERSONAS } from "./meta";

const PERSONA_IDS: PersonaId[] = [
  "bogle", "markowitz", "buffett", "marks", "dalio", "taleb", "simons", "soros",
];

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["personas"],
  properties: {
    personas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "persona",
          "summary_en", "summary_zh",
          "insight_en", "insight_zh", "insight_evidence_ids",
          "challenge_en", "challenge_zh",
        ],
        properties: {
          persona: { type: "string", enum: PERSONA_IDS },
          summary_en: { type: "string" },
          summary_zh: { type: "string" },
          insight_en: { type: "string" },
          insight_zh: { type: "string" },
          insight_evidence_ids: { type: "array", items: { type: "string" } },
          challenge_en: { type: "string" },
          challenge_zh: { type: "string" },
        },
      },
    },
  },
} as const;

interface LlmPersonaOut {
  persona: PersonaId;
  summary_en: string;
  summary_zh: string;
  insight_en: string;
  insight_zh: string;
  insight_evidence_ids: string[];
  challenge_en: string;
  challenge_zh: string;
}

const SYSTEM_PROMPT = `You are the deliberation secretary of an investment committee of eight members, each a decision framework inspired by a famous investor's published philosophy. A deterministic rule engine has already produced each member's rating, stance and base arguments from an evidence table. Your job is to deepen the QUALITATIVE reasoning only.

Hard rules:
- You may ONLY use facts from the provided evidence table. Every factual claim must cite evidence ids (like "E3"). Never invent numbers, events, or facts not in the table.
- Do NOT change or second-guess any rating, stance, veto, or allocation — those are fixed by the rule engine.
- Write in each member's framework and voice (their philosophy is provided). Be specific and incisive, not generic.
- For each member produce: (1) a sharper 1-2 sentence summary of their position given the evidence; (2) ONE new insight argument the rule engine missed — a connection between evidence items, a tension, or a second-order implication — citing the evidence ids it rests on; (3) a pointed cross-examination challenge aimed at the rest of the committee.
- Every field must be provided in both English (_en) and Chinese (_zh). Chinese should be natural, not translated word-for-word.
- If the evidence is too thin for a member to say anything beyond the engine's output, still return the member with a summary restating their position and an insight explaining exactly WHICH evidence is missing (cite nothing, that is acceptable for this case only).`;

function buildUserPayload(
  asset: AssetInfo,
  evidence: Evidence[],
  opinions: PersonaOpinion[]
): string {
  const evidenceRows = evidence.map((e) => ({
    id: e.id,
    statement: e.statement.en,
    direction: e.direction,
    source: `${e.citation.sourceName} (${e.citation.sourceLevel}, published ${e.citation.publishedAt})`,
    confidence: e.confidence,
  }));
  const engineRows = opinions.map((o) => ({
    persona: o.persona,
    philosophy: PERSONAS[o.persona].philosophy.en,
    firstQuestion: PERSONAS[o.persona].firstQuestion.en,
    rating: o.rating,
    stance: o.stance,
    vetoTriggered: !!o.veto?.triggered,
    engineArguments: o.arguments.map((a) => a.text.en),
    engineRisks: o.risks.map((r) => r.text.en),
  }));
  return JSON.stringify(
    {
      asset: { ticker: asset.ticker, name: asset.name, type: asset.assetType, sector: asset.sector ?? null },
      evidenceTable: evidenceRows,
      ruleEngineOpinions: engineRows,
    },
    null,
    1
  );
}

export interface LlmEnrichResult {
  enriched: boolean;
  warning?: L;
}

/**
 * Mutates `opinions` in place with LLM-deepened text. Returns whether
 * enrichment happened and an optional user-facing warning on failure.
 */
export async function enrichWithLLM(input: {
  asset: AssetInfo;
  evidence: Evidence[];
  opinions: PersonaOpinion[];
}): Promise<LlmEnrichResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { enriched: false };

  const model = process.env.COMMITTEE_LLM_MODEL ?? "claude-opus-4-8";

  try {
    const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        format: { type: "json_schema", schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> },
      },
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildUserPayload(input.asset, input.evidence, input.opinions) },
      ],
    });

    if (response.stop_reason === "refusal") {
      return {
        enriched: false,
        warning: l(
          "LLM deliberation declined this request; showing rule-engine output only.",
          "LLM 深化本次请求被拒绝,仅展示规则引擎输出。"
        ),
      };
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("no text block in LLM response");
    const parsed = JSON.parse(textBlock.text) as { personas: LlmPersonaOut[] };

    const validIds = new Set(input.evidence.map((e) => e.id));
    const byPersona = new Map(input.opinions.map((o) => [o.persona, o]));

    for (const p of parsed.personas) {
      const op = byPersona.get(p.persona);
      if (!op) continue;
      // Evidence-only enforcement: ids not in the table are dropped silently.
      const citedIds = [...new Set(p.insight_evidence_ids.filter((id) => validIds.has(id)))];

      if (p.summary_en.trim() && p.summary_zh.trim()) {
        op.summary = l(p.summary_en.trim(), p.summary_zh.trim());
      }
      if (p.insight_en.trim() && p.insight_zh.trim()) {
        op.arguments.push({
          text: l(p.insight_en.trim(), p.insight_zh.trim()),
          evidenceIds: citedIds,
          isInference: citedIds.length === 0,
        });
        op.citedEvidenceIds = [...new Set([...op.citedEvidenceIds, ...citedIds])];
      }
      if (p.challenge_en.trim() && p.challenge_zh.trim()) {
        op.challenge = l(p.challenge_en.trim(), p.challenge_zh.trim());
      }
      op.llmEnriched = true;
    }

    return { enriched: true };
  } catch {
    return {
      enriched: false,
      warning: l(
        "LLM deliberation unavailable (API error); showing rule-engine output only.",
        "LLM 深化不可用(API 调用失败),仅展示规则引擎输出。"
      ),
    };
  }
}

import type { PersonaOpinion } from "@/lib/types";
import { CommitteeInput } from "./helpers";
import { bogle } from "./bogle";
import { markowitz } from "./markowitz";
import { buffett } from "./buffett";
import { marks } from "./marks";
import { dalio } from "./dalio";
import { taleb } from "./taleb";
import { simons } from "./simons";
import { soros } from "./soros";
import { buildDisagreements, synthesize } from "./synthesis";

export { PERSONAS, PERSONA_ORDER } from "./meta";
export type { CommitteeInput } from "./helpers";

export function runCommittee(input: CommitteeInput) {
  const opinions: PersonaOpinion[] = [
    bogle(input),
    markowitz(input),
    buffett(input),
    marks(input),
    dalio(input),
    taleb(input),
    simons(input),
    soros(input),
  ];
  buildDisagreements(opinions);
  const decision = synthesize(opinions, input.ctx.evidence, input.isEtf);
  return { opinions, decision };
}

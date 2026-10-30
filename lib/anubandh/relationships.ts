import type { Family, Member, Person } from "./types";

export type FamilyLink = {
  from_id: string;
  to_id: string;
  kind: string;
};
type RelationshipContext = {
  member: Member;
  family: Family;
  people: Person[];
  links: FamilyLink[];
};
type Step = "parent" | "child" | "sibling" | "partner";
type Edge = { to: string; step: Step };

const roles: Record<string, Step> = {
  mother: "parent", mom: "parent", mum: "parent", father: "parent", dad: "parent", parent: "parent",
  daughter: "child", son: "child", child: "child",
  sister: "sibling", sis: "sibling", brother: "sibling", bro: "sibling", sibling: "sibling",
  wife: "partner", husband: "partner", spouse: "partner", partner: "partner",
};
const female = new Set(["mother", "mom", "mum", "daughter", "sister", "sis", "wife", "grandmother", "granddaughter", "aunt", "niece"]);
const male = new Set(["father", "dad", "son", "brother", "bro", "husband", "grandfather", "grandson", "uncle", "nephew"]);
const labels: Record<string, [string, string, string]> = {
  parent: ["mother", "father", "parent"],
  child: ["daughter", "son", "child"],
  sibling: ["sister", "brother", "sibling"],
  partner: ["wife", "husband", "partner"],
  grandparent: ["grandmother", "grandfather", "grandparent"],
  grandchild: ["granddaughter", "grandson", "grandchild"],
  auntUncle: ["aunt", "uncle", "parent's sibling"],
  nieceNephew: ["niece", "nephew", "sibling's child"],
};
const composed: Record<string, string> = {
  "parent,child": "sibling",
  "parent,parent": "grandparent",
  "child,child": "grandchild",
  "parent,sibling": "auntUncle",
  "sibling,child": "nieceNephew",
};

// Relationships are explicit family data, never inferred from a person's name.
export function relationshipLabel(
  target: Person | Member,
  context: RelationshipContext,
): string {
  const { member, family, people, links } = context;
  if (target.family_id !== family.id || member.family_id !== family.id)
    return "Family member";
  const primaryId = `primary:${family.id}`;
  const identity = (person: Person | Member) => "role" in person
    ? person.role === "primary" ? primaryId : person.person_id
    : person.id;
  const viewerId = identity(member);
  const targetId = identity(target);
  if (viewerId && viewerId === targetId) return "You";
  const role = target.relationship.trim().toLowerCase();
  const fallback = "role" in target && target.role === "primary"
    ? "Family member"
    : `${family.primary_name}'s ${role || "family member"}`;
  if (member.role === "primary") return `Your ${role || "family member"}`;
  if (!viewerId || !targetId) return fallback;

  const graph = new Map<string, Edge[]>();
  const add = (from: string, to: string, step: Step) => {
    graph.set(from, [...(graph.get(from) ?? []), { to, step }]);
  };
  const connect = (from: string, to: string, step: Step) => {
    add(from, to, step);
    add(to, from, step === "parent" ? "child" : step === "child" ? "parent" : step);
  };
  const known = new Set(people.filter(p => p.family_id === family.id).map(p => p.id));
  for (const link of links) {
    if (!known.has(link.from_id) || !known.has(link.to_id)) continue;
    if (link.kind === "parent") connect(link.from_id, link.to_id, "child");
    else if (link.kind === "partner" || link.kind === "sibling")
      connect(link.from_id, link.to_id, link.kind);
  }
  for (const person of people) {
    const step = roles[person.relationship.trim().toLowerCase()];
    if (person.family_id === family.id && step) connect(primaryId, person.id, step);
  }
  const direct = (graph.get(viewerId) ?? []).filter(edge => edge.to === targetId);
  const candidates = new Set<string>(direct.map(edge => edge.step));
  if (!direct.length) {
    for (const first of graph.get(viewerId) ?? []) {
      for (const second of graph.get(first.to) ?? []) {
        const result = composed[`${first.step},${second.step}`];
        if (second.to === targetId && result) candidates.add(result);
      }
    }
  }
  // Ambiguous paths and partners' children need clarification, not assumptions.
  if (candidates.size !== 1) return fallback;
  const result = labels[[...candidates][0]];
  return `Your ${result[female.has(role) ? 0 : male.has(role) ? 1 : 2]}`;
}

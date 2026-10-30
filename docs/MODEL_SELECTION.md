# Nebius Model Selection

## Photo Understanding Update: October 27, 2026

The authenticated catalog lists `nvidia/Nemotron-3.5-Super-VL` with text/image
input and text output, at $0.30/M input tokens and $0.90/M output tokens. A live
public-demo image request succeeded using a JSON-only response validated with
Zod. Forced tool calling produced inconsistent duplicate fragments and is not
used for this vision path. The existing Nano text workflows remain separate.
See [photo implementation and verification](PHOTO_UNDERSTANDING.md).

The observations below describe the earlier OpenLoop text-model evaluation, not
the current catalog or SDK retry policy. Current clients disable SDK retries.

## Original Text Evaluation

Checked against the authenticated Token Factory catalog on October 3, 2026.
The catalog returned **25 models**, including these four NVIDIA models. Prices
below are catalog prices per million tokens, not measured charges or guarantees.

| Exact Model ID | Context | Input | Output | Decision |
| --- | ---: | ---: | ---: | --- |
| `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | 262,144 | $0.06 | $0.24 | Default for extraction, evaluation and drafting |
| `nvidia/Nemotron-3_5-Lightning` | 1,048,576 | $0.06 | $0.24 | Listed, but probes timed out during this session |
| `nvidia/nemotron-3-super-120b-a12b` | 262,144 | $0.30 | $0.90 | Simple requests worked; full evaluation timed out |
| `nvidia/Nemotron-3-Ultra-550b-a55b` | 1,048,576 | $1.00 | $3.00 | Listed; not benchmarked in this iteration |

All four advertise `tools` and `reasoning`, but not `json_mode` or
`structured_outputs` in the catalog. We use one forced `report_result` function and
validate its arguments with Zod, then verify exact source quotations. We do not
assume schema-constrained generation or execute model-proposed actions.

Other catalog families include Qwen (including an embedding model), Gemma, GPT-OSS,
Hermes, GLM, Kimi, DeepSeek, MiniMax and MiniCPM. They are not the primary model
choice because this project's hackathon integration centers on an NVIDIA model.
No embedding model is necessary for the current project-scoped SQL lookup.
Run `npm run models` for the full current list, capabilities and prices.

## Observed Results

Nano passed nine evidence scenarios: explicit approval, pending approval, negation,
wrong actor, wrong project, hypothetical approval, conflicting evidence, revocation,
and instructions embedded in a note attempting to force approval.
The first pass's evidence latency was 2.06-6.28 seconds (mean 3.57 seconds).
On the final rerun it was **2.05-14.66 seconds**, mean **4.85 seconds** (nine requests).
These small samples show meaningful latency variation; they are not an SLA.
One later browser draft request exceeded the test's initial 60-second wait and
completed afterward, still awaiting approval. The SDK allows one retry with a
45-second timeout per attempt. The UI remains pending while a request is in flight.

The first extraction test failed: an ambiguous `actor` field was interpreted as the
task owner instead of the condition's approver. We clarified both the field
description and prompt. The subsequent extraction passed with the correct approver
and exact source quote (7.59 seconds). Empty extraction passed (0.89 seconds), as did
draft generation without claiming prior delivery (5.54 seconds).

The first browser import of a different project's conditional instruction returned
no candidates; a second attempt extracted the expected memory. This is an observed
false negative, not hidden by fixture fallback. We clarified that conditional
instructions count as commitments and added this case to the opt-in test suite.
The final run with the revised prompt passed all **13 live tests** in 65.8 seconds,
including both projects. This does not eliminate the need for broader held-out tests.

Super answered a tiny chat request in 1.24 seconds and a minimal forced-tool request
in 1.84 seconds, but the full evidence request exhausted two 45-second attempts.
Lightning exhausted the full request timeout and a separate 20-second chat probe.
These are observations from this session, not evidence that either model is
generally unavailable or less capable. No automatic switch to another model occurs.

**Why Nano now:** it completed the tested workflow, has the lowest listed token
price alongside Lightning, and its context window comfortably exceeds our 20,000
character note limit. Add a more expensive model only after a broader evaluation
shows a benefit that justifies added routing complexity and latency.

## Limits of This Evaluation

This is a small synthetic smoke suite, not a benchmark of general model quality.
Some negative cases accept either `uncertain` or `unsatisfied`; neither authorizes
action. There is no statistical accuracy claim, calibrated confidence score, or
production reliability guarantee. Prompt tuning used these same examples, so a
held-out dataset is still needed. No private workspace documents were benchmarked.

For the submission, expand to multiple projects, actors, temporal ordering,
quoted approvals, numeric conditions, injection variants, duplicates and long notes.
Track false activations, quotation validity, latency percentiles and token usage.

## Sources

- [Hackathon requirements](https://nebiusglobalaihackathon.devpost.com/)
- [Hackathon resources](https://nebiusglobalaihackathon.devpost.com/resources)
- [Nebius model catalog API](https://docs.tokenfactory.nebius.com/api-reference/examples/list-of-models)
- [Nebius function calling](https://docs.tokenfactory.nebius.com/ai-models-inference/function-calling)
- Live catalog: `GET https://api.tokenfactory.nebius.com/v1/models?verbose=true`

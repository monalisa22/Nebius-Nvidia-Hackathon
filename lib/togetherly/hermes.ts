import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { aiStatus } from "../anubandh/ai";
import { DomainError, isDomainError } from "../anubandh/store";
import { TOKEN_FACTORY_BASE_URL } from "../ai/token-factory";
import { hermesPython, hermesStatus } from "./hermes-status";
import { callSkillSchema, ritualResultSchema, type RitualReceipt, type RitualRun } from "./ritual-contracts";
import { validateRitual, type RitualService } from "./ritual-service";

const noArgs = z.object({}).strict();
function exactQuoteOptions(text: string, evidenceId: string | null) {
  const sentences = text.match(/[^.!?\n]+(?:[.!?]+|$)/gu) ?? [];
  const quotes = sentences.map(value => value.trim()).filter(value => value.length >= 20 && value.length <= 500);
  const fallback = text.trim().slice(0, 500).trim();
  return (quotes.length ? quotes : fallback ? [fallback] : []).slice(0, 4)
    .map(quote => ({ evidenceId, quote }));
}
const schemas = {
  load_call_skill: { description: "Load the user's approved call-preparation routine. It is not permission to take actions.", schema: noArgs },
  get_approved_updates: { description: "Read only the memories explicitly chosen for this run, with viewer-relative relationships.", schema: noArgs },
  get_recent_preparations: { description: "Read previously used questions from this ritual's still-permitted memories to avoid repetition.", schema: noArgs },
  prepare_connection: { description: "Propose a source-linked call preparation for validation. Does not send anything.", schema: ritualResultSchema },
  propose_skill: { description: "Propose new routine preferences for user approval. Cannot change sources, schedules, recipients or permissions.", schema: callSkillSchema },
};

// Native Hermes tools use a private pipe; the host, not tool descriptions, authorizes each request.
export class HermesTools {
  readonly receipt: RitualReceipt[] = [];
  private completed = new Set<string>();
  output: unknown;
  constructor(readonly service: RitualService, readonly run: RitualRun) {}

  private history(sourceIds: string[]) {
    const readable = new Set(sourceIds);
    return this.service.store.all<RitualRun>("SELECT * FROM ritual_runs WHERE ritual_id=? AND status IN ('ready','applied') AND task='prepare' AND expires_at>? ORDER BY created_at DESC LIMIT 3", this.run.ritual_id, Date.now())
      .flatMap(p => p.result ? ritualResultSchema.parse(JSON.parse(p.result)).moments.filter(m => readable.has(m.sourceId)).map(m => ({ sourceId: m.sourceId, question: m.question })) : []);
  }

  definitions() {
    const names = this.run.task === "learn" ? ["load_call_skill", "propose_skill"] : ["load_call_skill", "get_approved_updates", "get_recent_preparations", "prepare_connection"];
    return names.map(name => {
      const spec = schemas[name as keyof typeof schemas];
      return { name, description: spec.description, parameters: zodResponseFormat(spec.schema, name).json_schema.schema };
    });
  }

  handle(name: string, input: unknown) {
    const { packet } = this.service.runContext(this.run);
    if (!this.definitions().some(t => t.name === name)) throw new DomainError("This tool is not permitted.", 403);
    const args = schemas[name as keyof typeof schemas].schema.parse(input);
    let result: unknown;
    switch (name) {
      case "load_call_skill":
        result = { version: this.run.revision, preferences: packet.preferences, language: packet.language,
          previousPreparationsAvailable: this.run.task === "prepare" && this.history(packet.sources.map(s => s.id)).length > 0,
          procedure: "Read selected memories, check previous questions, prepare short captions with exact evidence, offer only an allowed next step. For reviewed photoEvidence, set evidenceId to its id and quote its text; otherwise quote the original caption with evidenceId=null. Tags do not identify people in photos. Never test memory or infer feelings." };
        break;
      case "get_approved_updates":
        result = {
          ...packet,
          sources: packet.sources.map(source => ({
            ...source,
            exactQuoteOptions: [
              ...exactQuoteOptions(source.caption, null),
              ...(source.photoEvidence ? exactQuoteOptions(source.photoEvidence.text, source.photoEvidence.id) : []),
            ],
          })),
        };
        break;
      case "get_recent_preparations": {
        result = this.history(packet.sources.map(s => s.id));
        break;
      }
      case "prepare_connection":
        if (!["load_call_skill", "get_approved_updates"].every(n => this.completed.has(n)))
          throw new DomainError("Call load_call_skill and get_approved_updates before prepare_connection.", 409);
        if (this.history(packet.sources.map(s => s.id)).length && !this.completed.has("get_recent_preparations"))
          throw new DomainError("Call get_recent_preparations before prepare_connection because earlier questions are available.", 409);
        if (this.output) throw new DomainError("A proposal has already been submitted.", 409);
        try {
          this.output = validateRitual(args, packet);
        } catch (error) {
          if (isDomainError(error) && error.message === "The preparation did not match its chosen sources.") {
            throw new DomainError(
              "For each moment, use a selected sourceId only once. For written memories set evidenceId to null and copy quote as one exact contiguous excerpt from that source caption; do not paraphrase, stitch, or alter the quote.",
            );
          }
          throw error;
        }
        result = { accepted: true, delivery: "not-authorized", next: "Finish. The user will review the preparation in Togetherly." };
        break;
      case "propose_skill":
        if (!this.completed.has("load_call_skill")) throw new DomainError("Load the current routine before suggesting changes.", 409);
        if (this.output) throw new DomainError("A proposal has already been submitted.", 409);
        this.output = callSkillSchema.parse(args);
        result = { accepted: true, applied: false, next: "Finish. The proposed change awaits the user's approval." };
        break;
    }
    this.completed.add(name);
    this.receipt.push({ tool: name, status: "completed", at: Date.now() });
    return result;
  }
}

export async function prepareWithHermes(service: RitualService, run: RitualRun) {
  const status = aiStatus();
  if (!hermesStatus().available) throw new DomainError("The Hermes pilot is not configured.");
  if (status.mode === "fixture") throw new DomainError("Hermes requires live NVIDIA inference. Offline previews use the direct engine.");
  if (!status.configured) throw new DomainError("Configure Nebius and a NVIDIA model first.");
  const bridge = new HermesTools(service, run);
  service.runContext(run);
  const home = await mkdtemp(path.join(tmpdir(), "togetherly-hermes-"));
  const started = Date.now();
  try {
    const stats = await new Promise<{ apiCalls: number }>((resolve, reject) => {
      const child = spawn(hermesPython(), [path.resolve("scripts/hermes/runner.py")], {
        cwd: home, stdio: ["pipe", "pipe", "ignore"],
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PATH: `${path.dirname(hermesPython())}:/usr/bin:/bin`, HOME: home, HERMES_HOME: home,
          PYTHONPATH: path.resolve(".runtime/hermes-agent"), PYTHONDONTWRITEBYTECODE: "1", PYTHONUNBUFFERED: "1",
          NEBIUS_API_KEY: process.env.NEBIUS_API_KEY!, LANG: "C.UTF-8",
        },
      });
      let buffer = "";
      let bytes = 0;
      let calls = 0;
      let result: { apiCalls: number } | null = null;
      let failure: Error | null = null;
      const stop = (error: Error) => { failure ??= error; child.kill("SIGKILL"); };
      const shutdown = () => stop(new DomainError("Hermes preparation stopped with the worker.", 503));
      process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
      const timeout = setTimeout(() => stop(new DomainError("Hermes preparation timed out. Please try again.", 503)), 240000);
      const permissionCheck = setInterval(() => {
        try { service.runContext(run); } catch { stop(new DomainError("Preparation stopped because its permissions or memories changed.", 409)); }
      }, 1000);
      child.on("error", () => { failure = new DomainError("Hermes could not start. Check the local runtime installation."); });
      child.stdin.on("error", () => { stop(new DomainError("Hermes disconnected before preparation completed.")); });
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 256000) { stop(new DomainError("Hermes exceeded the output limit.")); return; }
        buffer += chunk;
        let index: number;
        while ((index = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
          try {
            const message = JSON.parse(line);
            if (message.type === "tool") {
              if (process.env.TOGETHERLY_HERMES_DIAGNOSTICS === "true" && bridge.definitions().some(t => t.name === message.name)) console.log(`Hermes tool: ${message.name}`);
              if (++calls > 12) throw new DomainError("Hermes exceeded the tool-call limit.");
              try {
                const data = bridge.handle(message.name, message.args);
                child.stdin.write(JSON.stringify({ ok: true, data }) + "\n");
              } catch (error) {
                const detail = isDomainError(error) ? error.message : error instanceof z.ZodError
                  ? `Follow the tool schema exactly: ${error.issues.slice(0, 5).map(issue => `${issue.path.join(".") || "arguments"} (${issue.code})`).join(", ")}.`
                  : "Invalid arguments. Follow the tool schema exactly; do not add fields.";
                if (process.env.TOGETHERLY_HERMES_DIAGNOSTICS === "true") console.log(`Hermes tool validation: ${detail}`);
                if (isDomainError(error) && error.status === 403) throw error;
                service.runContext(run);
                child.stdin.write(JSON.stringify({ ok: false, error: detail }) + "\n");
              }
            } else if (message.type === "phase" && ["import", "initialization", "inference"].includes(message.stage)) {
              if (process.env.TOGETHERLY_HERMES_DIAGNOSTICS === "true") console.log(`Hermes phase: ${message.stage}`);
            } else if (message.type === "done") {
              if (!Number.isInteger(message.apiCalls) || message.apiCalls < 1 || message.apiCalls > 10 || !bridge.output)
                throw new DomainError("Hermes did not complete a valid preparation.");
              result = { apiCalls: message.apiCalls };
            } else if (message.type === "error") {
              const stage = ["startup", "import", "initialization", "tool-surface", "inference"].includes(message.stage) ? message.stage : "runtime";
              const kind = ["TypeError", "ValueError", "RuntimeError", "ModuleNotFoundError", "AttributeError", "ImportError"].includes(message.kind) ? message.kind : "error";
              throw new DomainError(`Hermes ${stage} failed (${kind}). Check the pinned runtime installation.`);
            } else throw new DomainError("Unexpected Hermes response.");
          } catch (e) { stop(isDomainError(e) ? e : new DomainError("Hermes returned an invalid response.")); }
        }
      });
      child.on("close", code => {
        clearTimeout(timeout); clearInterval(permissionCheck);
        process.removeListener("SIGTERM", shutdown); process.removeListener("SIGINT", shutdown);
        if (failure) reject(failure);
        else if (code !== 0 || !result) reject(new DomainError("Hermes did not complete preparation. Check runtime and provider availability."));
        else resolve(result);
      });
      child.stdin.write(JSON.stringify({ model: status.model, baseUrl: TOKEN_FACTORY_BASE_URL, task: run.task,
        instruction: run.instruction, tools: bridge.definitions() }) + "\n");
    });
    service.runContext(run);
    return { content: bridge.output, provider: "hermes-nebius", model: status.model, receipt: bridge.receipt,
      apiCalls: stats.apiCalls, durationMs: Date.now() - started };
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

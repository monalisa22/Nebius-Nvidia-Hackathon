import { existsSync } from "node:fs";
import path from "node:path";

export const HERMES_REVISION = "9b904dcc22c23fe8b82834339bbdd96495072e59";
export function hermesStatus() {
  const enabled = process.env.TOGETHERLY_HERMES_ENABLED === "true";
  const installed = existsSync(hermesPython()) && existsSync(path.resolve(".runtime/hermes-agent/run_agent.py"));
  return { enabled, installed, available: enabled && installed, revision: HERMES_REVISION };
}
export function hermesPython() {
  return path.resolve(process.env.TOGETHERLY_HERMES_PYTHON || ".runtime/hermes-venv/bin/python");
}

import { z } from "zod";
import { requireMember } from "@/lib/anubandh/auth";
import { DomainError, getStore } from "@/lib/anubandh/store";
import { aiStatus } from "@/lib/anubandh/ai";
import {
  apiError,
  future,
  jsonBody,
  optionalText,
  text,
  uuid,
} from "@/lib/anubandh/http";
import { removeMediaFile } from "@/lib/anubandh/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const member = await requireMember();
    return Response.json(
      { ...getStore().snapshot(member), provider: aiStatus() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const member = await requireMember();
    const store = getStore();
    const action = z.string().parse(body.action);
    let result: Record<string, unknown> = {};
    switch (action) {
      case "memory-add": {
        const input = z
          .object({
            title: text,
            caption: z
              .string()
              .trim()
              .max(4000),
            kind: z.enum(["photo", "voice", "story", "update"]),
            personIds: z.array(uuid).max(20),
            audience: z.array(z.string()).max(30),
            mediaId: uuid.nullable().optional(),
            expiresAt: future.nullable().optional(),
          })
          .refine(value => value.kind === "photo" || value.caption.length > 0, "Add the known details in a caption.")
          .parse(body);
        result = { id: store.addMemory(member, input) };
        break;
      }
      case "memory-review": {
        const input = z
          .object({
            id: uuid,
            revision: z.number().int(),
            decision: z.enum(["approved", "rejected"]),
          })
          .parse(body);
        store.reviewMemory(member, input.id, input.decision, input.revision);
        break;
      }
      case "memory-edit": {
        const input = z
          .object({
            id: uuid,
            revision: z.number().int(),
            title: text,
            caption: z.string().trim().max(4000),
            expiresAt: future.nullable(),
            audience: z.array(z.string()).max(30),
            personIds: z.array(uuid).max(20).optional(),
          })
          .parse(body);
        store.editMemory(
          member,
          input.id,
          input.revision,
          input.title,
          input.caption,
          input.expiresAt,
          input.audience,
          input.personIds,
        );
        break;
      }
      case "memory-delete": {
        removeMediaFile(store.deleteMemory(member, uuid.parse(body.id)));
        break;
      }
      case "person-add": {
        result = {
          id: store.addPerson(
            member,
            z
              .object({ name: text, relationship: text, about: optionalText })
              .parse(body),
          ),
        };
        break;
      }
      case "person-edit": {
        const input = z
          .object({
            id: uuid,
            name: text,
            relationship: text,
            about: optionalText,
          })
          .parse(body);
        store.editPerson(member, input.id, input);
        break;
      }
      case "invite": {
        const input = z
          .object({
            name: text,
            relationship: text,
            view: z.boolean(),
            contribute: z.boolean(),
            schedule: z.boolean(),
          })
          .parse(body);
        result = { token: store.invite(member, input) };
        break;
      }
      case "access": {
        const input = z
          .object({
            id: uuid,
            active: z.boolean(),
            view: z.boolean(),
            contribute: z.boolean(),
            schedule: z.boolean(),
            expiresAt: future.nullable(),
          })
          .parse(body);
        store.setAccess(member, input.id, input);
        break;
      }
      case "settings": {
        store.settings(
          member,
          z
            .object({
              language: z.enum(["en", "hi"]),
              timezone: text,
              hour: z.number().int().min(0).max(23),
              cloud: z.boolean(),
            })
            .parse(body),
        );
        break;
      }
      case "call-add": {
        const input = z
          .object({ personId: uuid, scheduledAt: future, note: optionalText })
          .parse(body);
        result = {
          id: store.scheduleCall(
            member,
            input.personId,
            input.scheduledAt,
            input.note,
          ),
        };
        break;
      }
      case "call-cancel": {
        store.cancelCall(member, uuid.parse(body.id));
        break;
      }
      case "generate": {
        const input = z
          .object({
            kind: z.enum(["briefing", "call"]),
            callId: uuid.nullable().default(null),
          })
          .parse(body);
        result = { id: store.queue(member, input.kind, input.callId) };
        break;
      }
      case "job": {
        const input = z
          .object({ id: uuid, operation: z.enum(["retry", "cancel"]) })
          .parse(body);
        store.jobAction(member, input.id, input.operation);
        break;
      }
      case "reply-create": {
        const input = z
          .object({
            recipientId: uuid,
            text: optionalText,
            mediaId: uuid.nullable(),
          })
          .parse(body);
        result = {
          id: store.createMessage(
            member,
            input.recipientId,
            input.text,
            input.mediaId,
          ),
        };
        break;
      }
      case "reply-send": {
        const input = z
          .object({ id: uuid, revision: z.number().int() })
          .parse(body);
        store.sendMessage(member, input.id, input.revision);
        break;
      }
      case "reply-delete": {
        removeMediaFile(store.deleteMessage(member, uuid.parse(body.id)));
        break;
      }
      case "reply-open": {
        store.openMessage(member, uuid.parse(body.id));
        break;
      }
      default:
        throw new DomainError("Unknown action.");
    }
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}

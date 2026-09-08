// Shared strict validation and mutation conventions for the supply domain.
import { newId } from "../store.js";
import { recordAudit } from "../routes/helpers.js";
export class SupplyError extends Error {
  constructor(message, status = 400, code = "validation_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function fail(message, status, code) {
  throw new SupplyError(message, status, code);
}
export function fields(value, allowed, name = "payload") {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${name} must be an object`);
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    fail(`${name} contains unsupported fields`);
}
export function text(value, max = 240, name = "value", min = 0) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    value.trim().length < min
  )
    fail(`${name} must be text between ${min} and ${max} characters`);
  return value.trim();
}
export function num(value, name, min = 0, max = 1e12) {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail(`${name} must be between ${min} and ${max}`);
  return value;
}
export function choice(value, values, name) {
  if (!values.includes(value)) fail(`invalid ${name}`);
  return value;
}
export function strings(value, name, max = 20) {
  if (!Array.isArray(value) || value.length > max)
    fail(`${name} must be a list of at most ${max} entries`);
  const clean = value.map((v) => text(v, 160, name, 1));
  if (new Set(clean.map((v) => v.toLowerCase())).size !== clean.length)
    fail(`${name} contains duplicates`);
  return clean;
}
export function boolean(value, name) {
  if (typeof value !== "boolean") fail(`${name} must be true or false`);
  return value;
}
export function actor(id) {
  if (!id) fail("authentication required", 401, "no_token");
}
export function revision(row, value) {
  if (!Number.isSafeInteger(value) || value < 1) fail("revision is required");
  if (row.revision !== value)
    fail(
      "This record changed. Reload it before saving.",
      409,
      "revision_conflict",
    );
}
export function event(actorId, action, changedFields = []) {
  return {
    id: newId("suevt"),
    actorId,
    action,
    changedFields,
    at: new Date().toISOString(),
  };
}
export function audit(type, id, e, revision) {
  try {
    recordAudit(`supply.${e.action}`, {
      actorId: e.actorId,
      objectType: type,
      objectId: id,
      after: { revision, changedFields: e.changedFields },
    });
  } catch (err) {
    console.error(
      "Supply saved with embedded history; secondary audit unavailable",
      err,
    );
  }
}
export function leadTime(value) {
  fields(value, ["minDays", "maxDays"], "leadTime");
  const minDays = num(value.minDays ?? null, "Minimum days", 0, 3650);
  const maxDays = num(value.maxDays ?? null, "Maximum days", 0, 3650);
  if (minDays !== null && maxDays !== null && minDays > maxDays)
    fail("Minimum turnaround cannot exceed maximum turnaround");
  return { minDays, maxDays };
}

import { Prisma } from "@prisma/client";
import { getRequestContext } from "./requestContext";

// Deliberately a curated allowlist, not every model — high-volume telemetry (SensorReading,
// GeotechnicalReading, VentilationReading, etc.) would drown out anything worth reviewing.
// Add a model name here to start auditing it; no other code changes needed.
export const AUDITED_MODELS = new Set([
  "StatutoryAppointment",
  "IodClaim",
  "DisciplinaryCase",
  "GrievanceCase",
  "CcmaCase",
  "UnionAgreement",
  "RockfallIncident",
  "SeismicEvent",
  "TailingsInspection",
  "ShaftInspection",
  "WinderInspection",
  "ConveyanceRope",
  "SecurityIncident",
  "AuditFinding",
  "HazardReport",
  "EmergencyEvent",
  "CommunityGrievance",
  "ResourceEstimate",
  "LegalComplianceItem",
  "Permit",
  "Certificate",
  "Expense",
  "PurchaseOrder",
  "Invoice",
  "ExecutiveInvite",
  "AiRecommendation",
]);

const AUDITED_OPERATIONS = new Set(["create", "update", "delete", "upsert"]);

function toAuditAction(operation: string): "CREATE" | "UPDATE" | "DELETE" {
  if (operation === "create") return "CREATE";
  if (operation === "delete") return "DELETE";
  return "UPDATE"; // update, upsert
}

// Strips anything Postgres' jsonb column can't hold (Bytes/BigInt) rather than letting the
// write throw — a best-effort snapshot is far more useful than a failed audit insert.
function toJsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, v) => {
        if (typeof v === "bigint") return v.toString();
        if (v instanceof Uint8Array) return "[binary omitted]";
        return v;
      })
    );
  } catch {
    return undefined;
  }
}

export function auditLogExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: "auditLog",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const result = await query(args);
            if (AUDITED_MODELS.has(model) && AUDITED_OPERATIONS.has(operation)) {
              const entityId = (result as { id?: string } | null)?.id;
              if (entityId) {
                const ctx = getRequestContext();
                // Fire-and-forget: audit logging must never slow down or fail the request
                // that triggered it.
                client.auditLog
                  .create({
                    data: {
                      mineId: ctx?.mineId ?? null,
                      entityType: model,
                      entityId,
                      action: toAuditAction(operation),
                      changedById: ctx?.userId ?? null,
                      snapshot: toJsonSafe(result),
                    },
                  })
                  .catch(() => {});
              }
            }
            return result;
          },
        },
      },
    })
  );
}

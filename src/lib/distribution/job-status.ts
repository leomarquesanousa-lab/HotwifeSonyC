import { db } from "../../prisma/db";

export function aggregatePublicationStatus(statuses: string[]) {
  if (statuses.some((s) => s === "PUBLISHING")) return "PUBLISHING";
  if (statuses.some((s) => s === "PROCESSING")) return "PROCESSING";
  if (statuses.some((s) => s === "QUEUED" || s === "PENDING" || s === "DRAFT")) return "QUEUED";
  if (statuses.some((s) => s === "SCHEDULED")) return "SCHEDULED";
  if (statuses.length > 0 && statuses.every((s) => s === "PUBLISHED")) return "COMPLETED";
  if (statuses.some((s) => s === "FAILED")) return "FAILED";
  return "QUEUED";
}

// Only reconcile jobs containing ManyVids; existing single-platform behavior is unchanged.
export async function reconcileManyVidsJob(jobId: string, workspaceId: string) {
  await db.transaction(async (tx) => {
    const job = await tx.orm.public.DistributionJob.where({ id: jobId, workspaceId }).first();
    if (!job) return;
    const rows = await tx.orm.public.PlatformPublication.where({ distributionJobId: jobId, workspaceId }).all();
    if (!rows.some((row) => row.platform === "MANYVIDS")) return;
    // Serialize reconciliations of this aggregate, then read a fresh set of child states.
    await tx.orm.public.DistributionJob.where({ id: jobId, workspaceId }).update({ status: job.status });
    const current = await tx.orm.public.PlatformPublication.where({ distributionJobId: jobId, workspaceId }).all();
    const status = aggregatePublicationStatus(current.map((row) => row.status));
    const failed = current.some((row) => row.status === "FAILED");
    await tx.orm.public.DistributionJob.where({ id: jobId, workspaceId }).update({
      status, startedAt: job.startedAt ?? current.find((row) => row.startedAt)?.startedAt ?? null,
      completedAt: status === "COMPLETED" || status === "FAILED" ? new Date().toISOString() : null,
      lastErrorCode: failed ? "PUBLICATION_FAILED" : null,
      lastErrorMessage: failed ? "Uma ou mais publicações falharam; consulte o estado de cada destino." : null,
    });
  });
}

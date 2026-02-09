import { prisma } from "@/lib/prisma";
import { job_type, job_status } from "@/generated/prisma";

export async function enqueueJob(
  type: job_type,
  payload: Record<string, any>,
  runAfter?: Date
) {
  return prisma.job.create({
    data: {
      type,
      payload,
      status: "queued",
      runAfter: runAfter || new Date(),
    },
  });
}

export async function claimNextJob(): Promise<{
  id: string;
  type: job_type;
  payload: any;
  attempts: number;
} | null> {
  const now = new Date();

  const jobs = await prisma.$queryRawUnsafe<
    Array<{ id: string; type: job_type; payload: any; attempts: number }>
  >(
    `UPDATE jobs
     SET status = 'running', updated_at = NOW(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM jobs
       WHERE status = 'queued' AND run_after <= $1
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, type, payload, attempts`,
    now
  );

  return jobs.length > 0 ? jobs[0] : null;
}

export async function completeJob(jobId: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "completed" },
  });
}

export async function failJob(jobId: string, error: string, maxAttempts = 3) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  if (job.attempts >= maxAttempts) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "failed", error },
    });
  } else {
    const backoffMs = Math.pow(2, job.attempts) * 5000;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "queued",
        error,
        runAfter: new Date(Date.now() + backoffMs),
      },
    });
  }
}

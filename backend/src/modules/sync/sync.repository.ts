import { prisma } from '../../config/database';
import {
  SyncJobType,
  SyncJobStatus,
  Prisma,
} from '@prisma/client';

export class SyncRepository {
  async createJob(type: SyncJobType, targetKey?: string, payload?: any) {
    return prisma.syncJob.create({
      data: {
        type,
        targetKey,
        payload: payload
          ? (payload as Prisma.InputJsonValue)
          : undefined,
        status: SyncJobStatus.PENDING,
      },
    });
  }

  async updateJob(
    id: number,
    data: Partial<Prisma.SyncJobUpdateInput>
  ) {
    return prisma.syncJob.update({
      where: { id },
      data,
    });
  }

  async getPendingJobs(
    type: SyncJobType,
    limit: number = 50
  ) {
    return prisma.syncJob.findMany({
      where: {
        type,
        status: SyncJobStatus.PENDING,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
    });
  }

  async getApiRequestsUsed(dateKey: string): Promise<number> {
    const result = await prisma.syncJob.aggregate({
      where: {
        type: SyncJobType.API_USAGE,
        targetKey: dateKey,
      },
      _sum: {
        requestsUsed: true,
      },
    });

    return result._sum.requestsUsed ?? 0;
  }

    async hasRecentOrActiveJob(
    type: SyncJobType,
    targetKey: string,
    freshnessDays: number
  ): Promise<boolean> {
    const cutoff = new Date(
      Date.now() - freshnessDays * 24 * 60 * 60 * 1000
    );

    const existing = await prisma.syncJob.findFirst({
      where: {
        type,
        targetKey,
        OR: [
          {
            status: {
              in: [
                SyncJobStatus.PENDING,
                SyncJobStatus.RUNNING,
                SyncJobStatus.RETRY,
              ],
            },
          },
          {
            status: SyncJobStatus.COMPLETED,
            finishedAt: {
              gte: cutoff,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    return !!existing;
  }

  async createJobIfNeeded(
    type: SyncJobType,
    targetKey: string,
    payload?: unknown,
    freshnessDays: number = 30
  ) {
    const exists = await this.hasRecentOrActiveJob(
      type,
      targetKey,
      freshnessDays
    );

    if (exists) {
      return null;
    }

    return this.createJob(
      type,
      targetKey,
      payload
    );
  }

  async reserveApiRequest(
  dateKey: string,
  path: string,
  attempt: number,
  dailyBudget: number
  ): Promise<number | null> {
    return prisma.$transaction(async (tx) => {
      const lockKey = `tennisscope-api-quota:${dateKey}`;

      // Only one quota reservation for this date can run at a time.
      await tx.$queryRaw<Array<{ locked: number }>>`
      WITH quota_lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT 1::int AS locked
      FROM quota_lock
    `;

      const result = await tx.syncJob.aggregate({
        where: {
          type: SyncJobType.API_USAGE,
          targetKey: dateKey,
        },
        _sum: {
          requestsUsed: true,
        },
      });

      const used = result._sum.requestsUsed ?? 0;

      if (used >= dailyBudget) {
        return null;
      }

      const now = new Date();

      await tx.syncJob.create({
        data: {
          type: SyncJobType.API_USAGE,
          status: SyncJobStatus.COMPLETED,
          targetKey: dateKey,
          requestsUsed: 1,
          payload: {
            path,
            attempt,
          },
          startedAt: now,
          finishedAt: now,
        },
      });

      return dailyBudget - used - 1;
    });
  }
}

export const syncRepository = new SyncRepository();
// lib/queue.ts — lazy init so importing this module never opens Redis during Next.js build.
import { Queue } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'

function getRedisUrl(): string {
  return process.env.UPSTASH_REDIS_URL || 'redis://127.0.0.1:6379'
}

let _connection: IORedis | undefined
let _campaignQueue: Queue | undefined

export function getQueueConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
    })
  }
  return _connection
}

export function getCampaignQueue(): Queue {
  if (!_campaignQueue) {
    _campaignQueue = new Queue('campaign-send', {
      connection: getQueueConnection() as ConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    })
  }
  return _campaignQueue
}

export interface CampaignJobData {
  campaignId: string
  userId: string
  recipientId: string
}

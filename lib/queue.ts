// lib/queue.ts
import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.replace('https://', 'rediss://').replace('rest-', '')
// Note: BullMQ needs the Redis protocol, not REST. 
// If using Upstash, you'll need the redis:// or rediss:// URL.
// Assuming UPSTASH_REDIS_URL is provided for BullMQ.
const redisUrl = process.env.UPSTASH_REDIS_URL || 'redis://localhost:6379'

export const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
})

export const campaignQueue = new Queue('campaign-send', {
    connection: connection as any,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: true,
    },
})

export interface CampaignJobData {
    campaignId: string
    userId: string
    recipientId: string // campaign_contact.id
}

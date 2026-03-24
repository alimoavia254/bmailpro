// lib/encryption.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const KEY_LENGTH = 32
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY
    if (!rawKey) {
        throw new Error('Missing ENCRYPTION_KEY. Set a strong secret in environment variables.')
    }
    return Buffer.from(rawKey.padEnd(KEY_LENGTH)).slice(0, KEY_LENGTH)
}

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedData: string): string {
    try {
        const [ivHex, tagHex, encryptedText] = encryptedData.split(':')
        if (!ivHex || !tagHex || !encryptedText) return encryptedData // Fallback if not encrypted

        const iv = Buffer.from(ivHex, 'hex')
        const tag = Buffer.from(tagHex, 'hex')
        const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)

        decipher.setAuthTag(tag)

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
        decrypted += decipher.final('utf8')

        return decrypted
    } catch (err) {
        console.error('Decryption failed:', err)
        return encryptedData // Fallback
    }
}

function looksEncrypted(value: string): boolean {
    return /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(value)
}

/**
 * Handles both plaintext and encrypted secrets safely.
 * Throws when the value appears encrypted but cannot be decrypted.
 */
export function resolveStoredSecret(value: string, label = 'secret'): string {
    if (!value) return value
    const decrypted = decrypt(value)
    if (looksEncrypted(value) && decrypted === value) {
        throw new Error(`${label}_decrypt_failed`)
    }
    return decrypted
}

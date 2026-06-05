import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Field-level encryption for PII at rest (Aadhaar, PAN, bank account, GSTIN, phone).
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Key must be a 32-byte base64-encoded string from env: PII_ENCRYPTION_KEY
 *
 * Ciphertext format: base64(IV + ciphertext + authTag)
 * This is deterministic in format but each encryption produces a different result (random IV).
 */
export class FieldEncryption {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) {
      throw new Error(
        `FieldEncryption: key must be 32 bytes (got ${this.key.length}). Generate with: openssl rand -base64 32`,
      );
    }
  }

  /** Encrypt a plaintext string. Returns base64-encoded ciphertext. */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Pack: IV (16) + ciphertext (variable) + authTag (16)
    const packed = Buffer.concat([iv, encrypted, authTag]);
    return packed.toString('base64');
  }

  /** Decrypt a base64-encoded ciphertext. Returns plaintext string. */
  decrypt(ciphertext: string): string {
    const packed = Buffer.from(ciphertext, 'base64');

    if (packed.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('FieldEncryption.decrypt: ciphertext too short');
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(packed.length - TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Mask a value for display (e.g., "ABCDE1234F" → "XXXXXX234F").
   * Shows only the last `visibleChars` characters.
   */
  static mask(value: string, visibleChars = 4): string {
    if (value.length <= visibleChars) {
      return 'X'.repeat(value.length);
    }
    const masked = 'X'.repeat(value.length - visibleChars);
    return masked + value.slice(-visibleChars);
  }
}

import { FieldEncryption } from './encryption';
import * as crypto from 'crypto';

// Generate a valid 32-byte key for tests
const TEST_KEY = crypto.randomBytes(32).toString('base64');

describe('FieldEncryption', () => {
  let enc: FieldEncryption;

  beforeEach(() => {
    enc = new FieldEncryption(TEST_KEY);
  });

  describe('constructor', () => {
    it('accepts a valid 32-byte base64 key', () => {
      expect(() => new FieldEncryption(TEST_KEY)).not.toThrow();
    });

    it('rejects invalid key length', () => {
      const shortKey = crypto.randomBytes(16).toString('base64');
      expect(() => new FieldEncryption(shortKey)).toThrow('32 bytes');
    });
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('encrypts and decrypts a PAN number', () => {
      const pan = 'ABCDE1234F';
      const ciphertext = enc.encrypt(pan);
      expect(ciphertext).not.toBe(pan);
      expect(enc.decrypt(ciphertext)).toBe(pan);
    });

    it('encrypts and decrypts an Aadhaar number', () => {
      const aadhaar = '123456789012';
      const ciphertext = enc.encrypt(aadhaar);
      expect(enc.decrypt(ciphertext)).toBe(aadhaar);
    });

    it('encrypts and decrypts a GSTIN', () => {
      const gstin = '22ABCDE1234F1Z5';
      expect(enc.decrypt(enc.encrypt(gstin))).toBe(gstin);
    });

    it('produces different ciphertexts for the same plaintext (random IV)', () => {
      const value = 'ABCDE1234F';
      const c1 = enc.encrypt(value);
      const c2 = enc.encrypt(value);
      expect(c1).not.toBe(c2);
      // Both still decrypt to the same value
      expect(enc.decrypt(c1)).toBe(value);
      expect(enc.decrypt(c2)).toBe(value);
    });

    it('handles empty string', () => {
      expect(enc.decrypt(enc.encrypt(''))).toBe('');
    });

    it('handles unicode characters', () => {
      const hindi = 'खनिज नेक्सस';
      expect(enc.decrypt(enc.encrypt(hindi))).toBe(hindi);
    });
  });

  describe('tamper detection', () => {
    it('throws on corrupted ciphertext', () => {
      const ciphertext = enc.encrypt('test');
      const corrupted = Buffer.from(ciphertext, 'base64');
      const idx = corrupted.length - 5;
      const byte = corrupted[idx];
      if (byte !== undefined) corrupted[idx] = byte ^ 0xff;
      expect(() => enc.decrypt(corrupted.toString('base64'))).toThrow();
    });

    it('throws on truncated ciphertext', () => {
      expect(() => enc.decrypt('dG9vc2hvcnQ=')).toThrow('too short');
    });
  });

  describe('mask', () => {
    it('masks a PAN showing last 4', () => {
      expect(FieldEncryption.mask('ABCDE1234F')).toBe('XXXXXX234F');
    });

    it('masks a phone number showing last 4', () => {
      expect(FieldEncryption.mask('9876543210')).toBe('XXXXXX3210');
    });

    it('masks short strings entirely', () => {
      expect(FieldEncryption.mask('AB', 4)).toBe('XX');
    });

    it('custom visible chars', () => {
      expect(FieldEncryption.mask('123456789012', 6)).toBe('XXXXXX789012');
    });
  });
});

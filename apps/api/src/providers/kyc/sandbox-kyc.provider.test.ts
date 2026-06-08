import { SandboxKycProvider } from './sandbox-kyc.provider';

describe('SandboxKycProvider', () => {
  let provider: SandboxKycProvider;

  beforeEach(() => {
    provider = new SandboxKycProvider();
  });

  describe('verifyPan', () => {
    it('returns VERIFIED for normal PAN', async () => {
      const result = await provider.verifyPan('AAAAA1234A');
      expect(result.valid).toBe(true);
      expect(result.status).toBe('VERIFIED');
      expect(result.verifiedAt).toBeInstanceOf(Date);
    });

    it('returns FAILED for PAN starting with ZZZZZ', async () => {
      const result = await provider.verifyPan('ZZZZZ1234A');
      expect(result.valid).toBe(false);
      expect(result.status).toBe('FAILED');
    });

    it('includes details in response', async () => {
      const result = await provider.verifyPan('BBBBB1234A');
      expect(result.details).toBeDefined();
      expect(result.details?.['source']).toBe('sandbox');
    });
  });

  describe('verifyGstin', () => {
    it('returns VERIFIED for normal GSTIN', async () => {
      const result = await provider.verifyGstin('07AAAAA1234A1Z1');
      expect(result.valid).toBe(true);
      expect(result.status).toBe('VERIFIED');
    });

    it('returns FAILED for GSTIN starting with 99', async () => {
      const result = await provider.verifyGstin('99AAAAA1234A1Z1');
      expect(result.valid).toBe(false);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('pennyDropBank', () => {
    it('returns VERIFIED for normal account', async () => {
      const result = await provider.pennyDropBank('1234567890', 'HDFC0001234');
      expect(result.valid).toBe(true);
      expect(result.status).toBe('VERIFIED');
    });

    it('returns NOT_FOUND for all-zero account', async () => {
      const result = await provider.pennyDropBank('0000000000', 'HDFC0001234');
      expect(result.valid).toBe(false);
      expect(result.status).toBe('NOT_FOUND');
    });

    it('verifiedAt is a Date', async () => {
      const result = await provider.pennyDropBank('1234567890', 'SBIN0001234');
      expect(result.verifiedAt).toBeInstanceOf(Date);
    });
  });
});

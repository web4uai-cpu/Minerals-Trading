import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const TestSchema = z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(TestSchema);

  it('passes valid input through unchanged', () => {
    const input = { email: 'buyer@example.com', age: 30 };
    expect(pipe.transform(input)).toEqual(input);
  });

  it('strips unknown fields (Zod default: strip)', () => {
    const result = pipe.transform({ email: 'a@b.com', age: 1, extra: 'noise' });
    expect(result).not.toHaveProperty('extra');
  });

  it('throws BadRequestException on invalid input', () => {
    expect(() => pipe.transform({ email: 'not-an-email', age: -1 })).toThrow(
      BadRequestException,
    );
  });

  it('error payload contains code VALIDATION_ERROR', () => {
    try {
      pipe.transform({ email: 'bad' });
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as Record<string, unknown>;
      expect(body['code']).toBe('VALIDATION_ERROR');
    }
  });

  it('error payload lists each failing field with a path', () => {
    try {
      pipe.transform({ email: 'bad', age: -5 });
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as {
        issues: { path: string; message: string }[];
      };
      const paths = body.issues.map((i) => i.path);
      expect(paths).toContain('email');
      expect(paths).toContain('age');
    }
  });

  it('throws on missing required fields', () => {
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });

  it('throws when value is null', () => {
    expect(() => pipe.transform(null)).toThrow(BadRequestException);
  });

  it('throws when value is a primitive', () => {
    expect(() => pipe.transform('string')).toThrow(BadRequestException);
  });
});

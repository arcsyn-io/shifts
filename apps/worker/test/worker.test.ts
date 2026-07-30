import { describe, expect, it } from 'vitest';

describe('worker bootstrap', () => {
  it('is reserved for jobs and outbox processing', () => expect(true).toBe(true));
});

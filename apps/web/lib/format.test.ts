import { describe, expect, it } from 'vitest';
import { formatRupiah } from './format';

describe('formatRupiah', () => {
  it('formats Indonesian rupiah without decimals', () => {
    expect(formatRupiah(12500)).toContain('12.500');
  });
});

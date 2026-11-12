import { describe, expect, it } from 'vitest';
import { buildProductQrPayload, numericVariants, parseScanCode } from './scan-code.js';

describe('parseScanCode', () => {
  it('reads the app QR label', () => {
    expect(parseScanCode(buildProductQrPayload('SP2602234639'))).toMatchObject({ format: 'APP_QR', code: 'SP2602234639' });
    expect(parseScanCode('is:p:8934588012345').code).toBe('8934588012345');
  });

  it('reads GS1 Digital Link QR codes', () => {
    const parsed = parseScanCode('https://id.gs1.org/01/08934588012345/10/LOT1?17=261231');
    expect(parsed).toMatchObject({ format: 'GS1_DIGITAL_LINK', code: '08934588012345' });
    expect(parsed.candidates).toContain('8934588012345');
    expect(parseScanCode('https://brand.vn/01/08934588012345').format).toBe('GS1_DIGITAL_LINK');
  });

  it('treats plain digits as barcodes and anything else as text', () => {
    expect(parseScanCode(' 8934588012345 ')).toMatchObject({ format: 'BARCODE', code: '8934588012345' });
    expect(parseScanCode('https://shop.vn/khuyen-mai').format).toBe('TEXT');
    expect(parseScanCode('WIFI:S:cuahang;;').format).toBe('TEXT');
  });

  it('builds equivalent numeric forms (UPC-A, EAN-13, GTIN-14)', () => {
    expect(numericVariants('012345678905')).toEqual(expect.arrayContaining(['012345678905', '0012345678905', '00012345678905']));
    expect(numericVariants('08934588012345')).toContain('8934588012345');
    expect(numericVariants('SP123')).toEqual(['SP123']);
  });
});

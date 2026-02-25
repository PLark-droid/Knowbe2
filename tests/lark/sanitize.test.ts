import { sanitizeLarkFilterValue } from '../../src/lark/sanitize.js';

describe('sanitizeLarkFilterValue', () => {
  it('should escape backslashes and double quotes', () => {
    const value = 'A\\B "quoted"';
    expect(sanitizeLarkFilterValue(value)).toBe('A\\\\B \\"quoted\\"');
  });

  it('should replace CR/LF with spaces', () => {
    const value = 'line1\r\nline2\nline3';
    expect(sanitizeLarkFilterValue(value)).toBe('line1 line2 line3');
  });
});

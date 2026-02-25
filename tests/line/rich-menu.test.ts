import { createRichMenuObject } from '../../src/line/rich-menu.js';

describe('createRichMenuObject', () => {
  it('should embed the provided LIFF ID in health-check URI action', () => {
    const menu = createRichMenuObject('2001234567-AbCdEfGh');
    const healthCheckArea = menu.areas[2];

    expect(healthCheckArea?.action.type).toBe('uri');
    expect((healthCheckArea?.action as { uri?: string }).uri).toBe(
      'https://liff.line.me/2001234567-AbCdEfGh/health-check',
    );
  });
});

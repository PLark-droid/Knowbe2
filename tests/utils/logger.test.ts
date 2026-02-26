import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('forAgent should build PascalCase context', () => {
    const logger = Logger.forAgent('test') as unknown as { context: string };
    expect(logger.context).toBe('TestAgent');
  });

  it('debug/info/warn/error should output with serialized data', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const dateSpy = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-02-26T00:00:00.000Z');

    const logger = new Logger('Ctx');
    logger.debug('d', { n: 1 });
    logger.info('i', { n: 2 });
    logger.warn('w', { n: 3 });
    logger.error('e', { n: 4 });

    expect(logSpy).toHaveBeenCalledTimes(4);
    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('[2026-02-26T00:00:00.000Z] [Ctx]'),
      '{"n":1}',
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('[2026-02-26T00:00:00.000Z] [Ctx]'),
      '{"n":2}',
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('[2026-02-26T00:00:00.000Z] [Ctx]'),
      '{"n":3}',
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('[2026-02-26T00:00:00.000Z] [Ctx]'),
      '{"n":4}',
    );

    logSpy.mockRestore();
    dateSpy.mockRestore();
  });

  it('should log message without data as single argument', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const logger = new Logger('NoData');
    logger.info('hello');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]![0]).toContain('[NoData]');
    expect(logSpy.mock.calls[0]![0]).toContain('hello');
    expect(logSpy.mock.calls[0]!.length).toBe(1);

    logSpy.mockRestore();
  });
});

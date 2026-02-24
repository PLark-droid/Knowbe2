/**
 * Config manager tests
 */

import { loadConfig, resetConfig, ConfigError } from '../../src/config/index.js';

describe('Config Manager', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
    // Reset environment to a clean state
    delete process.env['LINE_CHANNEL_ACCESS_TOKEN'];
    delete process.env['LINE_CHANNEL_SECRET'];
    delete process.env['LINE_LIFF_ID'];
    delete process.env['LARK_APP_ID'];
    delete process.env['LARK_APP_SECRET'];
    delete process.env['LARK_BASE_APP_TOKEN'];
    delete process.env['GITHUB_TOKEN'];
    delete process.env['PORT'];
    delete process.env['REPOSITORY'];
    process.env['NODE_ENV'] = 'test';
  });

  afterAll(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  // ─── loadConfig with required=false ─────────────────────

  describe('loadConfig({ required: false })', () => {
    it('should return config with empty strings when env vars are not set', () => {
      const config = loadConfig({ required: false });

      expect(config.line.channelAccessToken).toBe('');
      expect(config.line.channelSecret).toBe('');
      expect(config.line.liffId).toBe('');
      expect(config.lark.appId).toBe('');
      expect(config.lark.appSecret).toBe('');
      expect(config.lark.baseAppToken).toBe('');
      expect(config.github.token).toBe('');
    });

    it('should use default port 3000 when PORT is not set', () => {
      const config = loadConfig({ required: false });
      expect(config.server.port).toBe(3000);
    });

    it('should use default repository when REPOSITORY is not set', () => {
      const config = loadConfig({ required: false });
      expect(config.github.repository).toBe('PLark-droid/Knowbe2');
    });

    it('should read NODE_ENV from environment', () => {
      process.env['NODE_ENV'] = 'test';
      resetConfig();
      const config = loadConfig({ required: false });
      expect(config.server.nodeEnv).toBe('test');
    });

    it('should pick up environment variables that are set', () => {
      process.env['LINE_CHANNEL_ACCESS_TOKEN'] = 'test-token-123';
      process.env['LARK_APP_ID'] = 'lark-app-id-456';
      resetConfig();

      const config = loadConfig({ required: false });
      expect(config.line.channelAccessToken).toBe('test-token-123');
      expect(config.lark.appId).toBe('lark-app-id-456');
    });

    it('should parse PORT as integer', () => {
      process.env['PORT'] = '8080';
      resetConfig();

      const config = loadConfig({ required: false });
      expect(config.server.port).toBe(8080);
    });
  });

  // ─── Caching ────────────────────────────────────────────

  describe('caching', () => {
    it('should cache the config after first load', () => {
      const config1 = loadConfig({ required: false });
      const config2 = loadConfig({ required: false });
      expect(config1).toBe(config2); // same reference
    });

    it('should return cached config even if env changes after first load', () => {
      const config1 = loadConfig({ required: false });
      process.env['LINE_CHANNEL_ACCESS_TOKEN'] = 'changed-after-load';
      const config2 = loadConfig({ required: false });

      // Should still be the old cached value
      expect(config2.line.channelAccessToken).toBe('');
      expect(config1).toBe(config2);
    });
  });

  // ─── resetConfig ────────────────────────────────────────

  describe('resetConfig', () => {
    it('should clear the cache so the next load reads fresh env', () => {
      const config1 = loadConfig({ required: false });
      expect(config1.line.channelAccessToken).toBe('');

      process.env['LINE_CHANNEL_ACCESS_TOKEN'] = 'fresh-token';
      resetConfig();

      const config2 = loadConfig({ required: false });
      expect(config2.line.channelAccessToken).toBe('fresh-token');
      expect(config1).not.toBe(config2);
    });
  });

  // ─── loadConfig with required=true ──────────────────────

  describe('loadConfig({ required: true })', () => {
    it('should throw ConfigError when required vars are missing', () => {
      expect(() => loadConfig({ required: true })).toThrow(ConfigError);
    });

    it('should include missing variable names in the error', () => {
      try {
        loadConfig({ required: true });
        // Should not reach here
        expect.unreachable('Expected ConfigError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        const configError = error as InstanceType<typeof ConfigError>;
        expect(configError.missingVars).toContain('LINE_CHANNEL_ACCESS_TOKEN');
        expect(configError.missingVars).toContain('LARK_APP_ID');
        expect(configError.missingVars).toContain('GITHUB_TOKEN');
      }
    });

    it('should not throw when all required vars are set', () => {
      process.env['LINE_CHANNEL_ACCESS_TOKEN'] = 'token';
      process.env['LINE_CHANNEL_SECRET'] = 'secret';
      process.env['LINE_LIFF_ID'] = 'liff-id';
      process.env['LARK_APP_ID'] = 'app-id';
      process.env['LARK_APP_SECRET'] = 'app-secret';
      process.env['LARK_BASE_APP_TOKEN'] = 'base-token';
      process.env['GITHUB_TOKEN'] = 'gh-token';
      resetConfig();

      const config = loadConfig({ required: true });
      expect(config.line.channelAccessToken).toBe('token');
      expect(config.lark.appId).toBe('app-id');
      expect(config.github.token).toBe('gh-token');
    });
  });

  // ─── Production mode defaults ───────────────────────────

  describe('production mode', () => {
    it('should default to required=true when NODE_ENV is production', () => {
      process.env['NODE_ENV'] = 'production';
      resetConfig();

      expect(() => loadConfig()).toThrow(ConfigError);
    });

    it('should default to required=false when NODE_ENV is not production', () => {
      process.env['NODE_ENV'] = 'development';
      resetConfig();

      expect(() => loadConfig()).not.toThrow();
    });
  });

  // ─── ConfigError class ────────────────────────────────

  describe('ConfigError', () => {
    it('should have name set to ConfigError', () => {
      const err = new ConfigError(['FOO', 'BAR']);
      expect(err.name).toBe('ConfigError');
    });

    it('should include missing vars in message', () => {
      const err = new ConfigError(['VAR_A', 'VAR_B']);
      expect(err.message).toContain('VAR_A');
      expect(err.message).toContain('VAR_B');
    });

    it('should store missingVars as a property', () => {
      const err = new ConfigError(['X', 'Y', 'Z']);
      expect(err.missingVars).toEqual(['X', 'Y', 'Z']);
    });

    it('should be an instance of Error', () => {
      const err = new ConfigError([]);
      expect(err).toBeInstanceOf(Error);
    });
  });
});

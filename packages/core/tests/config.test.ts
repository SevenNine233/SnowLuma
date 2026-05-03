import { describe, it, expect } from 'vitest';
import { loadOneBotConfig, makeDefaultOneBotConfig } from '../src/onebot/config';

describe('makeDefaultOneBotConfig', () => {
  it('returns default config structure', () => {
    const config = makeDefaultOneBotConfig();
    expect(config.httpServers).toHaveLength(1);
    expect(config.httpServers[0].host).toBe('0.0.0.0');
    expect(config.httpServers[0].port).toBe(3000);
    expect(config.httpPostEndpoints).toEqual([]);
    expect(config.wsServers).toHaveLength(1);
    expect(config.wsServers[0].port).toBe(3001);
    expect(config.wsClients).toEqual([]);
    expect(config.musicSignUrl).toBe('');
  });
});

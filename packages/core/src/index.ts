import { BridgeManager } from './bridge/manager';
import { OneBotManager } from './onebot/manager';
import { loadRuntimeConfig } from './common/runtime';
import { createLogger } from './utils/logger';
import { HookManager } from './hook/hook-manager';

const runtimeConfig = loadRuntimeConfig();
const log = createLogger('App');

async function main() {
  log.info('SnowLuma starting');

  const bridgeManager = new BridgeManager();
  const oneBotManager = new OneBotManager();
  // HookManager defaults its packet sink to bridgeManager.onPacket, so
  // every parsed hook packet reaches the per-UIN bridge dispatcher with
  // no intermediate layer.
  const hookManager = new HookManager({ bridgeManager });

  oneBotManager.bind(bridgeManager);

  if (
    (typeof __BUILD_WEBUI__ !== 'undefined' && __BUILD_WEBUI__) ||
    process.env.SNOWLUMA_DEV_WEBUI === '1'
  ) {
    try {
      const { initWebUI } = await import('./webui/server');
      await initWebUI(runtimeConfig.webuiPort || 5099, oneBotManager, hookManager);
    } catch (err) {
      log.error('Failed to start WebUI: ', err);
    }
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    log.warn('Shutting down...');
    oneBotManager.dispose();
    hookManager.dispose();
    process.exit(0);
  });
}

main().catch((error) => {
  log.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});

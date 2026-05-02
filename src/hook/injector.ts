import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ManualMapHandle {
  base: bigint;
  entry: bigint;
  size: number;
}

interface NativeHookAddon {
  getAllMainProcess(): number[];
  loadModuleManual(pid: number, dylibPath: string): ManualMapHandle;
  unloadModuleManual(pid: number, handle: ManualMapHandle): void;
}

export interface HookProcessBaseInfo {
  pid: number;
  name: string;
  path: string;
}

export interface HookInjectResult {
  method: 'loadModuleManual';
  handle?: ManualMapHandle;
}

let nativeAddon: NativeHookAddon | null = null;
let nativeLoadError: string | null = null;

function loadNativeAddon(addonPath: string): NativeHookAddon {
  const mod = { exports: {} as Record<string, unknown> };
  process.dlopen(mod, addonPath);
  return mod.exports as unknown as NativeHookAddon;
}

function platformBinaryName(ext: 'node' | 'dll'): string {
  if (process.platform === 'win32' && process.arch === 'x64') return `snowluma-win32-x64.${ext}`;
  return `snowluma-${process.platform}-${process.arch}.${ext}`;
}

function nativeSearchDirs(): string[] {
  return [
    path.resolve(__dirname, '..', '..', 'native'),
    path.resolve(__dirname, '..', 'native'),
    path.resolve(process.cwd(), 'dist', 'native'),
    path.resolve(process.cwd(), 'native'),
  ];
}

export function resolveHookNativePath(ext: 'node' | 'dll'): string | null {
  const fileName = platformBinaryName(ext);
  for (const dir of nativeSearchDirs()) {
    const fullPath = path.join(dir, fileName);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

export function getNativeHookAddon(): NativeHookAddon | null {
  if (nativeAddon) return nativeAddon;
  const addonPath = resolveHookNativePath('node');
  if (!addonPath) {
    nativeLoadError = `No hook native addon found for ${process.platform}-${process.arch}`;
    return null;
  }
  try {
    nativeAddon = loadNativeAddon(addonPath);
    nativeLoadError = null;
    return nativeAddon;
  } catch (error) {
    nativeLoadError = error instanceof Error ? error.message : String(error);
    return null;
  }
}

export function getNativeHookLoadError(): string | null {
  return nativeLoadError;
}

export function listHookProcesses(): HookProcessBaseInfo[] {
  const addon = getNativeHookAddon();
  if (!addon) return [];
  return [...new Set(addon.getAllMainProcess())]
    .filter(pid => Number.isInteger(pid) && pid > 0)
    .sort((a, b) => a - b)
    .map(pid => ({ pid, name: 'QQ.exe', path: '' }));
}

export function injectHookProcess(pid: number): HookInjectResult {
  const addon = getNativeHookAddon();
  if (!addon) {
    throw new Error(getNativeHookLoadError() ?? 'hook native addon is not available');
  }
  const dllPath = resolveHookNativePath('dll');
  if (!dllPath) {
    throw new Error(`No hook DLL found for ${process.platform}-${process.arch}`);
  }
  return { method: 'loadModuleManual', handle: addon.loadModuleManual(pid, dllPath) };
}

export function unloadHookProcess(pid: number, handle: ManualMapHandle): void {
  const addon = getNativeHookAddon();
  if (!addon) {
    throw new Error(getNativeHookLoadError() ?? 'hook native addon is not available');
  }
  addon.unloadModuleManual(pid, handle);
}

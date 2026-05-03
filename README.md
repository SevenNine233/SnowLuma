# ❄️ SnowLuma
> Next Remote Protocol Framework.


## 关于项目
项目处于开发初期，仅支持部分功能，持续高速迭代中，仅支持有头。

## 仓库结构

本仓库使用 **pnpm workspace** 进行多包管理。

```
SnowLuma/
├─ packages/
│  ├─ core/         @snowluma/core - Node.js 运行时（NTQQ packet sniffer + Hook + OneBot）
│  ├─ webui/        webui - React + Vite 前端
│  └─ runtime/      @snowluma/runtime - 发行包资源
│     ├─ launcher.bat
│     ├─ package.json   （随 dist 一起发布的运行时依赖清单）
│     └─ native/        平台预编译产物 (snowluma-win32-x64.{dll,node})
├─ tools/           辅助脚本（如 Python OneBot WS 测试）
├─ tsconfig.base.json
├─ tsconfig.json    monorepo 根 TS 项目（仅含 references）
├─ pnpm-workspace.yaml
└─ package.json     monorepo 根（脚本委托给 pnpm filter）
```

构建产物统一输出到仓库根 `dist/`，与发行流水线保持兼容。

## 常用命令

```bash
# 安装依赖
pnpm install

# 开发 — 核心运行时（tsx）
pnpm dev

# 开发 — WebUI 前端（vite dev server）
pnpm dev:web

# 仅构建核心
pnpm build

# 仅构建 WebUI
pnpm build:webui

# 一次构建核心 + WebUI 完整发行版（顺序固定 core → webui）
pnpm build:all

# 单元测试 / 类型检查 / Lint
pnpm test
pnpm typecheck
pnpm lint

# 直接对单个包操作
pnpm --filter @snowluma/core dev
pnpm --filter webui build
```

## 鸣谢
[LagrangeV2](https://github.com/LagrangeDev/LagrangeV2) - Proto

[NapCatQQ](https://github.com/NapNeko/NapCatQQ) - Scaner/Packet

## 辅助编程

推荐 Opus4.6 + Gemini3.1pro 对本项目辅助开发

本项目大量使用Ai技术。

## 加入我们
[SnowLuma-QQ](https://qm.qq.com/q/g3UMLpWALe)

[SnowLuma-Tg](https://t.me/napcatqq)
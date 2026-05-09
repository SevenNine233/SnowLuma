# 贡献指南

## 分支模型

SnowLuma 使用 **`main` + `dev`** 双分支模型：

- **`main`** — 受保护的稳定分支，仅接收来自 `dev` 的合并 PR。**禁止直接 push**。
- **`dev`** — 日常开发分支。所有功能、修复、文档变更都先提交到 `dev`。
- **`native/auto-update-*`** — 由 `SnowLuma Bot` 自动创建的原生产物更新分支（来自 `SnowLumaNative`，不需要手动维护）。

## 把 `dev` 合并到 `main`

新增工作流 `.github/workflows/promote-dev-to-main.yml` 会以 `SnowLuma Bot` 身份开 / 更新一个 `dev → main` 的 PR，并可选地自动合并。三种触发方式：

### 1. 提交信息标记（推荐日常使用）

向 `dev` push 一个提交，提交信息满足以下任一条件即触发：

- 任意位置包含 `[merge]`（不区分大小写）
- 以 `chore(release):` 开头（不区分大小写，符合 conventional commits 的发版习惯）

示例：

```text
fix: correct OneBot mention encoding [merge]
```

```text
chore(release): v1.7.0
```

提交被推到 `dev` 后，工作流会启用 PR 的 auto-merge（默认 `merge` 策略），分支保护满足后由机器人自动合并。

### 2. 推送 `v*` Tag

任何符合 `v*` 的 tag（如 `v1.7.0`、`v1.7.0-rc.1`）被推送时也会触发本工作流。tag 通常打在 `dev` HEAD 上，工作流随后开 PR 把 `dev` 合入 `main`。

> 注意：`release.yml` 同样监听 `v*` tag，并基于 tag 指向的 commit 构建发布产物。两者并行执行，互不冲突。

### 3. 手动触发

打开仓库 Actions 页面 → `Promote Dev to Main` → `Run workflow`。可选输入：

- `auto_merge`：是否启用 auto-merge（默认 `true`）。
- `merge_method`：`merge` / `squash` / `rebase`（默认 `merge`）。

工作流会按照当前 `dev` 与 `main` 的差异开 / 更新 PR。

## 启用 `main` 分支保护（必做）

仓库管理员需要在 GitHub 上为 `main` 配置一条规则集（Repository Rules）或经典分支保护，至少满足：

1. **Settings → Rules → Rulesets**（推荐）或 **Settings → Branches → Branch protection rules**。
2. 选择 `main` 作为目标分支。
3. 勾选：
   - **Restrict deletions** — 禁止删除 `main`。
   - **Require a pull request before merging** — 所有合并必须走 PR。
   - **Block force pushes** — 禁止强推。
   - （可选）**Require status checks to pass before merging** — 关联 `Dev Build` / `typecheck` 等检查。
4. 在 **Bypass list** 中加入 `SnowLuma Bot` GitHub App。这样 `gh pr merge --auto` 才能在没有人工 review 的情况下完成合并。
5. 不要把任何用户加入 push 白名单，确保「禁止向 `main` 直接提交」的约束生效。

## 必需的 Secrets

`promote-dev-to-main.yml` 复用 `SnowLumaNative/build-native.yml` 同一个 GitHub App。请确认 SnowLuma 仓库（或 organization）级别已经配置：

- `SNOWLUMA_BOT_APP_ID` — 数字类型的 App ID。
- `SNOWLUMA_BOT_PRIVATE_KEY` — 该 App 的 PEM 私钥。

App 必须在本仓库已安装，且授予 **Contents: Read+Write**、**Pull requests: Read+Write**。

## 本地工作流速查

```bash
# 切到 dev 开发
git checkout dev
git pull

# 写代码 / 跑测试
pnpm install
pnpm typecheck
pnpm -s --filter @snowluma/core test

# 普通提交（不会触发 promote）
git commit -m "fix: something"
git push

# 准备发布 / 合入 main
git commit -m "chore(release): v1.7.0"
# 或者
git commit -m "fix: hotfix [merge]"

git push                                # → 触发 promote-dev-to-main 工作流
# 或者
git tag v1.7.0 && git push origin v1.7.0  # → 同时触发 release.yml + promote-dev-to-main
```

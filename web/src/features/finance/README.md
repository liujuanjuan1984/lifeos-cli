# Finance 模块说明

## 目录结构

- `frontend/src/pages/finance/`：路由页面（BalanceSheetPage / CashflowPage / TradingPlansPage）
- `frontend/src/features/finance/balance/`：资产负债表相关组件与工具
- `frontend/src/features/finance/cashflow/`：现金流相关组件与工具
- `frontend/src/features/finance/trading/`：交易计划相关组件与工具
- `frontend/src/features/finance/shared/`：跨模块复用的组件、hooks 与工具函数

## 核心流程（快照导航）

- `useSnapshotSelection` 统一处理排序、选中、上一条/下一条逻辑
- `SnapshotNavigatorBase` 仅负责导航 UI，调用侧传入标题、按钮状态与文案
- 位置展示统一为 **1-based**（页面使用 `effectiveIndex + 1` 传入）

## 格式化约定

- 金额/比例/小数格式化集中在 `shared/utils/formatters.ts`
- 需要跨模块共享的数值工具放在 `shared/utils` 中

## 组件边界原则

- `shared`：可跨 balance/cashflow/trading 复用的组件或工具
- `balance`/`cashflow`/`trading`：业务专属 UI 与逻辑
- `pages/finance`：路由级状态拼装与页面布局，避免沉积可复用逻辑

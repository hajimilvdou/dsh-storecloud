export * from './ui/index.js'

/**
 * Client 半插件入口（浏览器侧）。生产接入点（DSH 插件 SDK）：
 *   1. 查询 Client Slot 树，把 `<StoreApp bridge={rpcBridge} />` 注册到 `shell.overlay`；
 *   2. `styles.insert(STORE_CSS)` 注入样式；
 *   3. `rpcBridge` 用 Host RPC 实现 `StoreBridge`（数据来自 Host 的 StoreClient）。
 * standalone 预览/测试直接用 `mockBridge()` 驱动 `StoreApp`。
 */
export function createClientPlugin(): { apply: (ctx: unknown) => void } {
  return {
    apply(ctx) {
      // TODO(client): 接入 DSH SDK —— 见上方注释。
      void ctx
    },
  }
}

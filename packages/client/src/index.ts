/**
 * @dsh-store/client —— DSH 插件商城客户端插件公开入口。
 * 分层：core（环境无关纯函数）/ data（数据源）/ store（台账）/ adapters（UIAdapter）。
 */
export * from './core/index.js'
export * from './data/source.js'
export { HttpDataSource } from './data/http.js'
export {
  MockDataSource,
  MOCK_PLUGINS,
  MOCK_COMBOS,
  MOCK_ANNOS,
  MOCK_SOURCES,
} from './data/mock.js'
export { Ledger, type KeyValueStore } from './store/ledger.js'
export type { UIAdapter } from './adapters/types.js'
export { WebUIAdapter } from './adapters/webui.js'
export { AddressAdapter } from './adapters/address.js'
export { StoreClient, createHostPlugin } from './host.js'
export { createClientPlugin } from './client.js'
export * from './ui/index.js'

import type { InstallRecord, RestorePoint } from '@dsh-store/shared'

/**
 * 本地已安装台账 + 还原点（v3.1 S2 / v3.2 S10）。
 * 数据存本地（登录与否都有）；登录用户可选云同步。
 * 存储后端注入（Node 用 fs / 浏览器用 localStorage），业务不感知。
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export class Ledger {
  private installs: InstallRecord[] = []
  private restorePoints: RestorePoint[] = []
  private readonly maxPoints: number

  constructor(
    private readonly store: KeyValueStore,
    private readonly scope: string,
    maxPoints = 10,
  ) {
    this.maxPoints = maxPoints
  }

  async load(): Promise<void> {
    this.installs = await this.read<InstallRecord[]>('installs', [])
    this.restorePoints = await this.read<RestorePoint[]>('restore_points', [])
  }

  listInstalls(): InstallRecord[] {
    return [...this.installs]
  }

  listRestorePoints(): RestorePoint[] {
    return [...this.restorePoints]
  }

  /** 记录安装（每次操作写台账：包名/版本/时间/来源/归属组/还原点）。 */
  addInstall(rec: InstallRecord): Promise<void> {
    const existing = this.installs.findIndex((i) => i.pkg === rec.pkg)
    if (existing >= 0) this.installs[existing] = rec
    else this.installs.push(rec)
    return this.persist()
  }

  removeInstall(pkg: string): Promise<void> {
    this.installs = this.installs.filter((i) => i.pkg !== pkg)
    return this.persist()
  }

  /** 快照还原点（安装/升级/卸载前调用），保留最近 maxPoints 个。 */
  async checkpoint(snapshot: unknown): Promise<void> {
    const point: RestorePoint = {
      id: `rp-${Date.now()}`,
      created_at: new Date().toISOString(),
      snapshot,
    }
    this.restorePoints.push(point)
    if (this.restorePoints.length > this.maxPoints) {
      this.restorePoints = this.restorePoints.slice(-this.maxPoints)
    }
    await this.persist()
  }

  private async read<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.store.get(`${this.scope}:${key}`)
    if (raw === null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  private async persist(): Promise<void> {
    await this.store.set(`${this.scope}:installs`, JSON.stringify(this.installs))
    await this.store.set(`${this.scope}:restore_points`, JSON.stringify(this.restorePoints))
  }
}

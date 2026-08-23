import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

export interface OpenWorkspaceFile {
  readonly path: string
  readonly content: string
  readonly truncated: boolean
  readonly sourceView: boolean
}

export interface FileExplorerSnapshot {
  readonly sessionId: SessionId | undefined
  readonly files: readonly OpenWorkspaceFile[]
  readonly activePath: string | undefined
}

const INITIAL: FileExplorerSnapshot = { sessionId: undefined, files: [], activePath: undefined }

/** Plugin-lifetime document state shared by Files tabs and its keyed view. */
export class FileExplorerStore {
  #snapshot: FileExplorerSnapshot = INITIAL
  readonly #listeners = new Set<() => void>()

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  readonly getSnapshot = (): FileExplorerSnapshot => this.#snapshot

  setSession(sessionId: SessionId | undefined): void {
    if (this.#snapshot.sessionId === sessionId) return
    this.#commit({ sessionId, files: [], activePath: undefined })
  }

  has(path: string): boolean {
    return this.#snapshot.files.some(file => file.path === path)
  }

  open(file: Omit<OpenWorkspaceFile, 'sourceView'>, sourceView: boolean): void {
    const next: OpenWorkspaceFile = { ...file, sourceView }
    const existing = this.#snapshot.files.findIndex(item => item.path === file.path)
    const files = existing < 0
      ? [...this.#snapshot.files, next]
      : this.#snapshot.files.map(item => item.path === file.path ? next : item)
    this.#commit({ ...this.#snapshot, files, activePath: file.path })
  }

  activate(path: string): void {
    if (this.#snapshot.activePath === path || !this.has(path)) return
    this.#commit({ ...this.#snapshot, activePath: path })
  }

  close(path: string): void {
    const index = this.#snapshot.files.findIndex(file => file.path === path)
    if (index < 0) return
    const files = this.#snapshot.files.filter(file => file.path !== path)
    const activePath = this.#snapshot.activePath === path
      ? files[Math.min(index, files.length - 1)]?.path
      : this.#snapshot.activePath
    this.#commit({ ...this.#snapshot, files, activePath })
  }

  toggleSource(path: string): void {
    if (!this.has(path)) return
    const files = this.#snapshot.files.map(file => file.path === path
      ? { ...file, sourceView: !file.sourceView }
      : file)
    this.#commit({ ...this.#snapshot, files })
  }

  #commit(snapshot: FileExplorerSnapshot): void {
    this.#snapshot = snapshot
    for (const listener of this.#listeners) listener()
  }
}

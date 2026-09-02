import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export class EmailCursorStore {
  constructor(path) {
    const target = path === ":memory:" ? path : resolve(path);
    if (target !== ":memory:") mkdirSync(dirname(target), { recursive: true });
    this.database = new DatabaseSync(target);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS email_cursors (
        account TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        cursor TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'paused')),
        last_error_class TEXT,
        updated_at TEXT NOT NULL
      ) STRICT;
    `);
  }

  get(account) {
    const row = this.database.prepare("SELECT * FROM email_cursors WHERE account = ?").get(account);
    return row ? { account: row.account, provider: row.provider, cursor: row.cursor, status: row.status, last_error_class: row.last_error_class, updated_at: row.updated_at } : null;
  }

  list() {
    return this.database.prepare("SELECT * FROM email_cursors ORDER BY updated_at DESC, account").all().map(row => ({
      account: row.account, provider: row.provider, cursor: row.cursor, status: row.status,
      last_error_class: row.last_error_class, updated_at: row.updated_at,
    }));
  }

  pause(account) { return this.setStatus(account, "paused"); }
  resume(account) { return this.setStatus(account, "healthy"); }
  disconnect(account) {
    validateAccount(account);
    this.database.prepare("DELETE FROM email_cursors WHERE account = ?").run(account);
  }

  setStatus(account, status) {
    validateAccount(account);
    assert.ok(new Set(["healthy", "degraded", "paused"]).has(status), "email cursor status is invalid");
    const result = this.database.prepare("UPDATE email_cursors SET status = ?, last_error_class = NULL, updated_at = ? WHERE account = ?")
      .run(status, new Date().toISOString(), account);
    assert.equal(result.changes, 1, `email account ${account} is not connected`);
    return this.get(account);
  }

  commit(account, cursor, { status = "healthy", errorClass = null, now = new Date() } = {}) {
    assert.ok(typeof account === "string" && account.length > 0 && account.length <= 320, "email account is invalid");
    assert.ok(typeof cursor === "string" && cursor.length > 0 && cursor.length <= 512, "email cursor is invalid");
    this.database.prepare(`
      INSERT INTO email_cursors (account, provider, cursor, status, last_error_class, updated_at)
      VALUES (?, 'gmail', ?, ?, ?, ?)
      ON CONFLICT(account) DO UPDATE SET cursor=excluded.cursor, status=excluded.status,
        last_error_class=excluded.last_error_class, updated_at=excluded.updated_at
    `).run(account, cursor, status, errorClass, now.toISOString());
    return this.get(account);
  }

  close() { this.database.close(); }
}

function validateAccount(account) {
  assert.ok(typeof account === "string" && account.length > 0 && account.length <= 320, "email account is invalid");
}

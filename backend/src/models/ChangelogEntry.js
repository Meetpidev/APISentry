import { pool } from "../config/db.js";

export const ChangelogEntryModel = {
  async getSeenHashes(providerId) {
    const { rows } = await pool.query(
      `SELECT entry_hash FROM changelog_entries WHERE provider_id = $1`,
      [providerId]
    );
    return new Set(rows.map((r) => r.entry_hash));
  },

  async recordSeen(providerId, entries) {
    if (entries.length === 0) return;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const e of entries) {
        await client.query(
          `INSERT INTO changelog_entries (provider_id, entry_hash, entry_text)
           VALUES ($1, $2, $3) ON CONFLICT (provider_id, entry_hash) DO NOTHING`,
          [providerId, e.hash, e.text]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async hasAnyEntries(providerId) {
    const { rows } = await pool.query(
      `SELECT 1 FROM changelog_entries WHERE provider_id = $1 LIMIT 1`,
      [providerId]
    );
    return rows.length > 0;
  },
};
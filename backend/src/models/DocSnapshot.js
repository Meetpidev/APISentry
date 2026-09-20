import { pool } from "../config/db.js";

export const DocSnapshotModel = {
  async getLatest(providerId, sourceType = "docs") {
    const { rows } = await pool.query(
      `SELECT * FROM provider_doc_snapshots
       WHERE provider_id = $1 AND source_type = $2
       ORDER BY fetched_at DESC LIMIT 1`,
      [providerId, sourceType]
    );
    return rows[0] || null;
  },

  async create(providerId, { contentHash, contentText, fetchedVia, sourceType = "docs" }) {
    const { rows } = await pool.query(
      `INSERT INTO provider_doc_snapshots (provider_id, content_hash, content_text, fetched_via, source_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [providerId, contentHash, contentText, fetchedVia || "fetch", sourceType]
    );
    return rows[0];
  },
};
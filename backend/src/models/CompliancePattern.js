import { pool } from "../config/db.js";

export const CompliancePatternModel = {
  async findByProvider(providerId) {
    const { rows } = await pool.query(
      `SELECT * FROM compliance_patterns WHERE provider_id = $1 ORDER BY created_at DESC`,
      [providerId]
    );
    return rows;
  },

  async create({ providerId, changeId, pattern, isRegex, title, description, severity, type, source }) {
    const { rows } = await pool.query(
      `INSERT INTO compliance_patterns (provider_id, change_id, pattern, is_regex, title, description, severity, type, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [providerId, changeId || null, pattern, isRegex, title, description, severity, type, source || "manual"]
    );
    return rows[0];
  },

  async delete(id) {
    const { rows } = await pool.query("DELETE FROM compliance_patterns WHERE id = $1 RETURNING id", [id]);
    return rows[0] || null;
  },
};
import { pool } from "../config/db.js";

export const ChangeModel = {
  async findAll({ type } = {}) {
    const params = [];
    let where = "";
    if (type && type !== "all") {
      params.push(type);
      where = `WHERE c.type = $${params.length}`;
    }
    const { rows } = await pool.query(
      `
      SELECT c.*, p.name AS provider_name, p.slug AS provider_slug,
        COALESCE(json_agg(
          json_build_object('repo', f.repo_name, 'file', f.file_path)
        ) FILTER (WHERE f.id IS NOT NULL), '[]') AS affected_files
      FROM changes c
      JOIN providers p ON p.id = c.provider_id
      LEFT JOIN change_affected_files f ON f.change_id = c.id
      ${where}
      GROUP BY c.id, p.name, p.slug
      ORDER BY c.detected_at DESC
      `,
      params
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `
      SELECT c.*, p.name AS provider_name, p.slug AS provider_slug,
        COALESCE(json_agg(
          json_build_object('repo', f.repo_name, 'file', f.file_path)
        ) FILTER (WHERE f.id IS NOT NULL), '[]') AS affected_files
      FROM changes c
      JOIN providers p ON p.id = c.provider_id
      LEFT JOIN change_affected_files f ON f.change_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, p.name, p.slug
      `,
      [id]
    );
    return rows[0] || null;
  },

  async create({ providerId, type, title, description, severity, affectedFiles = [], detectionSource = "manual", classificationMethod = "heuristic" }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO changes (provider_id, type, title, description, severity, detection_source, classification_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [providerId, type, title, description, severity, detectionSource, classificationMethod]
      );
      const change = rows[0];
      for (const f of affectedFiles) {
        await client.query(
          `INSERT INTO change_affected_files (change_id, repo_name, file_path) VALUES ($1, $2, $3)`,
          [change.id, f.repo, f.file]
        );
      }
      await client.query("COMMIT");
      return change;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async recordScanFinding({ providerId, title, description, severity, type, repoName, file }) {
    const existing = await pool.query(
      `SELECT c.* FROM changes c
       JOIN change_affected_files f ON f.change_id = c.id
       WHERE c.provider_id = $1 AND c.title = $2 AND f.repo_name = $3 AND f.file_path = $4
       ORDER BY c.detected_at DESC LIMIT 1`,
      [providerId, title, repoName, file]
    );
    if (existing.rows[0]) return existing.rows[0];

    return this.create({
      providerId, type: type || "deprecation", title, description,
      severity: severity || "medium", affectedFiles: [{ repo: repoName, file }],
      detectionSource: "repo_scan", classificationMethod: "heuristic",
    });
  },

  async markStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE changes SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0];
  },

   async delete(id) {
    const { rows } = await pool.query("DELETE FROM changes WHERE id = $1 RETURNING id", [id]);
    return rows[0] || null;
  },

  async deleteAll() {
    const { rowCount } = await pool.query("DELETE FROM changes");
    return rowCount;
  },
};
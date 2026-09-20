import { pool } from "../config/db.js";

export const GithubSettingsModel = {
  async get() {
    const { rows } = await pool.query("SELECT * FROM github_settings ORDER BY created_at DESC LIMIT 1");
    return rows[0] || null;
  },

  // Single active GitHub connection for this instance — deletes any prior
  // token before storing the new one. Fine for a personal/single-tenant tool;
  // a multi-user version would key this per user instead.
  async upsert({ token, username, avatarUrl }) {
    await pool.query("DELETE FROM github_settings");
    const { rows } = await pool.query(
      `INSERT INTO github_settings (token, username, avatar_url) VALUES ($1, $2, $3)
       RETURNING id, username, avatar_url, created_at`,
      [token, username, avatarUrl]
    );
    return rows[0];
  },
};
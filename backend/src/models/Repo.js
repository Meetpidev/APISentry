import { pool } from "../config/db.js";

export const RepoModel = {
  async findById(id) {
    const { rows } = await pool.query("SELECT * FROM watched_repos WHERE id = $1", [id]);
    return rows[0] || null;
  },
};
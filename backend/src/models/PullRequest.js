import { pool } from "../config/db.js";

export const PullRequestModel = {
  async findAll() {
    const { rows } = await pool.query(`SELECT * FROM pull_requests ORDER BY created_at DESC`);
    return rows;
  },

  async create({ changeId, repo, title, branch, baseBranch, filesChanged, diff, prNumber, prUrl, status }) {
    const { rows } = await pool.query(
      `INSERT INTO pull_requests (change_id, repo, title, branch, base_branch, files_changed, diff, pr_number, pr_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [changeId, repo, title, branch, baseBranch, filesChanged, diff, prNumber || null, prUrl || null, status || "open"]
    );
    return rows[0];
  },
};
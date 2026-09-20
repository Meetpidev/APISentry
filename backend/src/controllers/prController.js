import { PullRequestModel } from "../models/PullRequest.js";

export async function listPRs(req, res) {
  res.json(await PullRequestModel.findAll());
}
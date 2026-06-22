import { cronJobs } from "convex/server";

const crons = cronJobs();

// RSS feeds are now fetched client-side via Cloudflare Worker proxy.
// No background cron job needed.

export default crons;

import { after } from "next/server";

/**
 * Lets a job finish after the page has been sent. On Vercel a function is frozen as soon as
 * the response ends, so translations and warm-ups started "in the background" were cut off
 * and never cached; after() keeps the function alive until the job is done (within the
 * page's maxDuration). Elsewhere (local server) it simply runs on.
 */
export function background(job: Promise<unknown>) {
  job.catch(() => {});
  try {
    after(() => job);
  } catch {
    // Called outside a request (e.g. at start-up): nothing to keep alive.
  }
}

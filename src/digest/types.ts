// Types of the run log reader (issue #1).
// The implementation is `readNight`, exported from `src/digest/read.ts`.

/** A run's status, as written in the log. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job of one night: all valid log lines of that job, folded together. */
export type DigestRow = {
  job: string;
  /** Owner from the job's last line; `null` when the log says null (views show `—`). */
  owner: string | null;
  /** Every valid line of the job is a run. */
  runs: number;
  /** Lines with status `retry`. */
  retries: number;
  /** Lines with status `fail`. */
  fails: number;
  /** Status of the job's last line (file order = time order). */
  lastStatus: RunStatus;
  /** `error` of the job's latest line that has one, else `null`. */
  lastError: string | null;
  /** `at` of the job's first line, as written in the log (offset kept, never converted). */
  firstAt: string;
  /** `at` of the job's last line, as written in the log (offset kept, never converted). */
  lastAt: string;
};

/** Number of valid lines of the night per status. */
export type NightCounts = Record<RunStatus, number>;

/** The result of one night's log. An empty file gives `rows: []`, `badLines: 0`. */
export type Night = {
  night: string;
  /** One row per job, sorted by job (plain string comparison). */
  rows: DigestRow[];
  /** Non-blank lines that were not valid JSON or lacked the required fields. */
  badLines: number;
  counts: NightCounts;
};

/**
 * Reads `<runsDir>/<night>.jsonl`.
 * Returns `null` when there is no file, or when `night` is not `YYYY-MM-DD`.
 * Never throws on bad lines; never writes.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;

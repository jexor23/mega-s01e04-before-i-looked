import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify(error === undefined ? { at, job, status, owner } : { at, job, status, owner, error });

const NORMAL = '2026-01-10';
const EMPTY = '2026-01-11';
const BAD = '2026-01-12';
const MISSING = '2026-01-13';

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-routes-'));
  const t = (m: number) => `2026-01-10T02:0${m}:00+01:00`;
  fs.writeFileSync(
    path.join(runsDir, `${NORMAL}.jsonl`),
    [
      line(t(1), 'zulu-report', 'ok', 'ana'),
      line(t(2), 'bravo-export', 'retry', 'ops', 'timeout'),
      line(t(3), 'bravo-export', 'retry', 'ops', 'timeout'),
      line(t(4), 'bravo-export', 'retry', 'ops', 'timeout'),
      line(t(5), 'charlie-clean', 'fail', null, 'disk full'),
      line(t(6), 'alpha-sync', 'ok', 'ana'),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(runsDir, `${EMPTY}.jsonl`), '');
  fs.writeFileSync(
    path.join(runsDir, `${BAD}.jsonl`),
    [line('2026-01-12T02:01:00+01:00', 'beta', 'ok', 'ana'), 'not json at all', line('2026-01-12T02:02:00+01:00', 'alpha', 'ok', 'ana')].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

const rowChunk = (html: string, job: string) => html.split('<tr').find((c) => c.includes(job)) ?? '';

describe('digest page', () => {
  it('renders one table with rows in job order, warn rows and dashes', async () => {
    const res = await app.request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.match(/<table/g)).toHaveLength(1);
    const order = ['alpha-sync', 'bravo-export', 'charlie-clean', 'zulu-report'].map((j) => html.indexOf(j));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(rowChunk(html, 'bravo-export')).toContain('class="warn"');
    expect(rowChunk(html, 'charlie-clean')).toContain('class="warn"');
    expect(rowChunk(html, 'alpha-sync')).not.toContain('class="warn"');
    expect(rowChunk(html, 'charlie-clean')).toContain('—');
    expect(rowChunk(html, 'alpha-sync')).toContain('—');
    expect(html).toContain('<p class="mute">bad lines: 0</p>');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no run log for ${MISSING}`);
  });

  it('answers 404 for a name that is not a night', async () => {
    const res = await app.request('/digest/not-a-night');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for not-a-night');
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).toContain('<p class="mute">bad lines: 0</p>');
  });

  it('shows the count of bad lines and still lists the valid jobs', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<p class="mute">bad lines: 1</p>');
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('beta'));
  });
});

describe('digest JSON', () => {
  it('returns what readNight returns', async () => {
    const res = await app.request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(readNight(runsDir, NORMAL));
  });

  it('answers 404 with an error for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: `no run log for ${MISSING}` });
  });

  it('answers 404 for a name that is not a night', async () => {
    const res = await app.request('/api/digest/not-a-night');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for not-a-night' });
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('reports one bad line and keeps the valid rows', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    const body = (await res.json()) as { badLines: number; rows: { job: string }[] };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta']);
  });
});

describe('page and JSON agree', () => {
  it.each([NORMAL, BAD])('same job order for %s, equal to readNight', async (night) => {
    const expected = readNight(runsDir, night)?.rows.map((r) => r.job) ?? [];
    expect(expected.length).toBeGreaterThan(0);

    const json = (await (await app.request(`/api/digest/${night}`)).json()) as { rows: { job: string }[] };
    const html = await (await app.request(`/digest/${night}`)).text();
    const pageOrder = expected
      .map((job) => ({ job, at: html.indexOf(job) }))
      .sort((a, b) => a.at - b.at)
      .map((x) => x.job);

    expect(json.rows.map((r) => r.job)).toEqual(expected);
    expect(pageOrder).toEqual(expected);
  });
});

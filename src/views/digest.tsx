import type { Night } from '../digest/types.js';

const DASH = '—';

export function DigestHeading({ night }: { night: string }) {
  return <h1>digest {night}</h1>;
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <DigestHeading night={night} />
      <p>no run log for {night}</p>
    </>
  );
}

export function DigestView({ data }: { data: Night }) {
  return (
    <>
      <DigestHeading night={data.night} />
      {data.rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>fails</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr class={r.retries >= 3 || r.fails > 0 ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td>{r.owner ?? DASH}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.fails}</td>
                <td>{r.lastStatus}</td>
                <td>{r.lastError ?? DASH}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p class="mute">bad lines: {data.badLines}</p>
    </>
  );
}

import { getCharts, songLinks, type Song } from "@/lib/ent";

/**
 * Music charts on the Showbiz page, pinned under the title: Spotify's daily top 10 for
 * Vietnam and the world. Each song opens on YouTube, with a Zing MP3 link beside it.
 * A chart whose source fails is left out.
 */
export async function Charts({ lang }: { lang: "vi" | "en" }) {
  const { vn, global } = await getCharts();
  if (!vn.length && !global.length) return null;
  const vi = lang === "vi";
  const panel = (title: string, songs: Song[]) =>
    songs.length > 0 && (
      <section className="chart" aria-label={title}>
        <h2 className="chart-h">
          {title} <span>Spotify · {vi ? "hằng ngày" : "daily"}</span>
        </h2>
        <ol className="chart-list">
          {songs.map((s) => {
            const l = songLinks(s);
            return (
              <li key={s.id} className="chart-row">
                <a className="chart-main" href={l.youtube} target="_blank" rel="noopener noreferrer" title={vi ? "Nghe trên YouTube" : "Listen on YouTube"}>
                  <b className="chart-rank">{s.rank}</b>
                  <Move m={s.move} />
                  {s.cover ? <img src={s.cover} width={40} height={40} alt="" loading="lazy" decoding="async" /> : <span className="chart-noart" aria-hidden="true">♪</span>}
                  <span className="chart-txt">
                    <span className="chart-title">{s.title}</span>
                    <span className="chart-artist">{s.artist}</span>
                  </span>
                </a>
                <a className="chart-mp3" href={l.zing} target="_blank" rel="noopener noreferrer" title="Zing MP3" aria-label={`${s.title} – Zing MP3`}>MP3</a>
              </li>
            );
          })}
        </ol>
      </section>
    );
  return (
    <div className="charts">
      {panel(vi ? "BXH Việt Nam" : "Vietnam Top 10", vn)}
      {panel(vi ? "BXH Thế giới" : "Global Top 10", global)}
    </div>
  );
}

function Move({ m }: { m: Song["move"] }) {
  if (m === "new") return <i className="chart-mv new">NEW</i>;
  if (!m) return <i className="chart-mv same">–</i>;
  return <i className={`chart-mv ${m > 0 ? "up" : "down"}`}>{m > 0 ? "▲" : "▼"}{Math.abs(m)}</i>;
}

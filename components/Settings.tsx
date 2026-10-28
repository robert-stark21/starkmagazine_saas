"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Lang = "vi" | "en";

async function save(data: Record<string, string>) {
  const r = await fetch("/api/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(String(r.status));
}

// ---------- Left navigation of the settings dashboard ----------
const NAV = [
  { href: "/tai-khoan", vi: "Chuyên mục", en: "Sections", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/tai-khoan/nguon", vi: "Nguồn tin", en: "Sources", icon: "M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" },
  { href: "/tai-khoan/tien-ich", vi: "Tiện ích", en: "Widgets", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/tai-khoan/giao-dien", vi: "Giao diện", en: "Theme", icon: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.9-.6-1.2-.6-2 0-.8.7-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM10 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM15 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
];

export function SettingsNav({ lang }: { lang: Lang }) {
  const path = usePathname();
  return (
    <nav className="dash-nav" aria-label={lang === "vi" ? "Cài đặt" : "Settings"}>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""} aria-current={path === n.href ? "page" : undefined}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={n.icon} />
          </svg>
          {n[lang]}
        </Link>
      ))}
    </nav>
  );
}

// ---------- Save bar: changes apply only when the reader presses Save ----------
function SaveBar({ lang, dirty, state, onSave, onCancel }: { lang: Lang; dirty: boolean; state: "idle" | "saving" | "saved" | "error"; onSave: () => void; onCancel: () => void }) {
  const vi = lang === "vi";
  // Leaving the page with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);
  return (
    <div className={`save-bar${dirty ? " dirty" : ""}`} aria-live="polite">
      <span className="save-msg">
        {state === "saving" ? (vi ? "Đang lưu…" : "Saving…")
          : state === "error" ? (vi ? "Lưu không được, thử lại." : "Could not save, try again.")
          : dirty ? (vi ? "Bạn có thay đổi chưa lưu." : "You have unsaved changes.")
          : state === "saved" ? (vi ? "Đã lưu ✓" : "Saved ✓") : vi ? "Chưa có thay đổi." : "No changes."}
      </span>
      <button className="btn-ghost" onClick={onCancel} disabled={!dirty || state === "saving"}>{vi ? "Huỷ" : "Cancel"}</button>
      <button className="btn-primary" onClick={onSave} disabled={!dirty || state === "saving"}>{vi ? "Lưu" : "Save"}</button>
    </div>
  );
}

function useSaver<T>(initial: T, toPayload: (v: T) => Record<string, string>, after?: (v: T) => void) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  const doSave = async () => {
    setState("saving");
    try {
      await save(toPayload(value));
      setSaved(value);
      setState("saved");
      after?.(value);
      router.refresh();
    } catch {
      setState("error");
    }
  };
  return { value, setValue, saved, dirty, state, doSave, cancel: () => setValue(saved) };
}

// ---------- Sections ----------
type Sec = { slug: string; hidden: boolean; label: string; color: string };

export function SectionsEditor({ lang, initial, defaults, signedIn }: { lang: Lang; initial: Sec[]; defaults: string[]; signedIn: boolean }) {
  const vi = lang === "vi";
  const s = useSaver(initial, (list) => ({ sec: list.map((x) => (x.hidden ? "-" : "") + x.slug).join(",") }));
  const list = s.value;
  const toggle = (i: number) => {
    const next = list.map((x, j) => (j === i ? { ...x, hidden: !x.hidden } : x));
    if (!next.every((x) => x.hidden)) s.setValue(next);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    s.setValue(next);
  };
  const shown = list.filter((x) => !x.hidden).length;
  return (
    <div className="sec-edit">
      <p className="muted small">
        {vi
          ? `Đang hiện ${shown}/${list.length} mục. ${signedIn ? "Lưu vào tài khoản, dùng được trên mọi thiết bị." : "Lưu trên thiết bị này. Đăng nhập để dùng trên mọi thiết bị."}`
          : `Showing ${shown}/${list.length} sections. ${signedIn ? "Saved to your account, on every device." : "Saved on this device. Sign in to use them everywhere."}`}
      </p>
      <ul>
        {list.map((x, i) => (
          <li key={x.slug} className={x.hidden ? "off" : ""} style={{ ["--c" as any]: x.color }}>
            <span className="sec-dot" aria-hidden="true" />
            <span className="sec-name">{x.label}</span>
            <span className="sec-move">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={vi ? "Lên" : "Up"}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={vi ? "Xuống" : "Down"}>↓</button>
            </span>
            <button role="switch" aria-checked={!x.hidden} aria-label={x.label} className={`switch${x.hidden ? "" : " on"}`} onClick={() => toggle(i)}>
              <i />
            </button>
          </li>
        ))}
      </ul>
      <button className="btn-ghost" onClick={() => s.setValue([...list].map((x) => ({ ...x, hidden: false })).sort((a, b) => defaults.indexOf(a.slug) - defaults.indexOf(b.slug)))}>
        {vi ? "Khôi phục mặc định" : "Reset to default"}
      </button>
      <SaveBar lang={lang} dirty={s.dirty} state={s.state} onSave={s.doSave} onCancel={s.cancel} />
    </div>
  );
}

// ---------- Widgets ----------
export function WidgetToggles({ lang, widgets, off, sectionNames }: { lang: Lang; widgets: { id: string; label: string; where: string[] }[]; off: string[]; sectionNames: Record<string, string> }) {
  const vi = lang === "vi";
  const s = useSaver([...off].sort(), (v) => ({ wg: v.join(",") }));
  const hidden = new Set(s.value);
  const toggle = (id: string) => s.setValue(hidden.has(id) ? s.value.filter((x) => x !== id) : [...s.value, id].sort());
  return (
    <div className="sec-edit">
      <p className="muted small">{vi ? "Bật hoặc tắt các tiện ích hiện trên từng trang." : "Switch the widgets shown on each page on or off."}</p>
      <ul>
        {widgets.map((w) => (
          <li key={w.id} className={hidden.has(w.id) ? "off" : ""}>
            <span className="sec-name">
              {w.label}
              <small className="muted wg-where">{w.where.map((x) => sectionNames[x] ?? x).join(" · ")}</small>
            </span>
            <button role="switch" aria-checked={!hidden.has(w.id)} aria-label={w.label} className={`switch${hidden.has(w.id) ? "" : " on"}`} onClick={() => toggle(w.id)}>
              <i />
            </button>
          </li>
        ))}
      </ul>
      <SaveBar lang={lang} dirty={s.dirty} state={s.state} onSave={s.doSave} onCancel={s.cancel} />
    </div>
  );
}

// ---------- Site sources: see them all, switch some off ----------
type SiteSource = { key: string; name: string; host: string; region: "vn" | "intl" };
export function SiteSources({ lang, groups, off }: { lang: Lang; groups: { slug: string; label: string; color: string; sources: SiteSource[] }[]; off: string[] }) {
  const vi = lang === "vi";
  const s = useSaver([...off].sort(), (v) => ({ srcoff: v.join(",") }));
  const hidden = new Set(s.value);
  const toggle = (k: string) => s.setValue(hidden.has(k) ? s.value.filter((x) => x !== k) : [...s.value, k].sort());
  const total = groups.reduce((n, g) => n + g.sources.length, 0);
  return (
    <div className="sec-edit">
      <p className="muted small">
        {vi ? `STARK đang đọc ${total} nguồn. Tắt nguồn nào bạn không muốn thấy tin.` : `STARK reads ${total} sources. Switch off any you don't want stories from.`}
      </p>
      {groups.map((g) => (
        <details key={g.slug} className="src-group" style={{ ["--c" as any]: g.color }}>
          <summary>
            <span className="sec-dot" aria-hidden="true" />
            <b>{g.label}</b>
            <span className="muted small">
              {g.sources.filter((x) => !hidden.has(x.key)).length}/{g.sources.length} {vi ? "nguồn" : "sources"}
            </span>
          </summary>
          <ul>
            {g.sources.map((x) => (
              <li key={x.key} className={hidden.has(x.key) ? "off" : ""}>
                <span className="own-src">
                  <b>{x.region === "vn" ? "🇻🇳" : "🌐"} {x.name}</b>
                  <small className="muted">{x.host}</small>
                </span>
                <button role="switch" aria-checked={!hidden.has(x.key)} aria-label={x.name} className={`switch${hidden.has(x.key) ? "" : " on"}`} onClick={() => toggle(x.key)}>
                  <i />
                </button>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <SaveBar lang={lang} dirty={s.dirty} state={s.state} onSave={s.doSave} onCancel={s.cancel} />
    </div>
  );
}

// ---------- Theme, light/dark and page background ----------
type Palette = Record<string, string>;
type ThemeCard = { id: string; name: string; desc: string; font?: string; radius: string; light: Palette; dark: Palette };
type Bg = { preset: string; color: string; pattern: string };
type ThemeValue = { theme: string; scheme: "auto" | "light" | "dark"; bg: Bg };

const bgString = (b: Bg) => (b.preset || b.color || b.pattern ? `${b.preset}|${b.color}|${b.pattern}` : "");

export function ThemeSettings({
  lang, themes, initial, presets, patterns,
}: {
  lang: Lang;
  themes: ThemeCard[];
  initial: ThemeValue;
  presets: { id: string; label: string; light: string; dark: string }[];
  patterns: { id: string; label: string }[];
}) {
  const vi = lang === "vi";
  const s = useSaver(initial, (v) => ({ theme: v.theme, scheme: v.scheme, bg: bgString(v.bg) }));
  const v = s.value;

  // Preview on the page itself while choosing; Cancel (or leaving unsaved) puts the saved look back.
  const savedRef = useRef(s.saved);
  savedRef.current = s.saved;
  useEffect(() => () => apply(savedRef.current), []); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = (v: ThemeValue) => {
    const html = document.documentElement;
    html.dataset.theme = v.theme;
    html.dataset.scheme = v.scheme;
    if (v.bg.pattern) html.dataset.pattern = v.bg.pattern;
    else delete html.dataset.pattern;
    const p = presets.find((x) => x.id === v.bg.preset);
    const light = v.bg.color || p?.light || "";
    const dark = v.bg.color || p?.dark || "";
    html.style.setProperty("--page-bg-light", light || null);
    html.style.setProperty("--page-bg-dark", dark || null);
    if (!light) html.style.removeProperty("--page-bg-light");
    if (!dark) html.style.removeProperty("--page-bg-dark");
  };
  useEffect(() => apply(v), [v]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<ThemeValue>) => s.setValue({ ...v, ...patch });
  const setBg = (patch: Partial<Bg>) => set({ bg: { ...v.bg, ...patch } });

  const half = (p: Palette, t: ThemeCard) => (
    <div
      className="tc-half"
      style={{
        ["--p-bg" as any]: p.bg, ["--p-surface" as any]: p.surface, ["--p-text" as any]: p.text, ["--p-muted" as any]: p.muted,
        ["--p-line" as any]: p.line, ["--p-accent" as any]: p.accent, ["--p-brand" as any]: p.brand, ["--p-radius" as any]: t.radius,
        ["--p-font" as any]: t.font ?? "var(--font-sans)",
      }}
    >
      <div className="tc-bar"><span className="tc-logo" /><span className="tc-pill" /></div>
      <div className="tc-card">
        <span className="tc-t">{vi ? "Tin nổi bật hôm nay" : "Today's top story"}</span>
        <span className="tc-l" />
        <span className="tc-l s" />
        <span className="tc-btn">{vi ? "Đọc" : "Read"}</span>
      </div>
    </div>
  );

  return (
    <div className="theme-set">
      <h2>{vi ? "Chế độ màu" : "Colour mode"}</h2>
      <div className="scheme-seg" role="radiogroup" aria-label={vi ? "Chế độ màu" : "Colour mode"}>
        {([
          ["auto", vi ? "🖥️ Tự động" : "🖥️ Auto"],
          ["light", vi ? "☀️ Sáng" : "☀️ Light"],
          ["dark", vi ? "🌙 Tối" : "🌙 Dark"],
        ] as const).map(([k, label]) => (
          <button key={k} role="radio" aria-checked={v.scheme === k} className={v.scheme === k ? "on" : ""} onClick={() => set({ scheme: k })}>
            {label}
          </button>
        ))}
      </div>

      <h2>{vi ? "Kiểu giao diện" : "Theme"}</h2>
      <div className="theme-grid">
        {themes.map((t) => (
          <button key={t.id} className={`theme-card${v.theme === t.id ? " on" : ""}`} onClick={() => set({ theme: t.id })} aria-pressed={v.theme === t.id}>
            <div className="tc-prev">
              {half(t.light, t)}
              {half(t.dark, t)}
            </div>
            <div className="tc-body">
              <div className="tc-name">
                {t.name}
                {v.theme === t.id && <span className="tc-check" aria-hidden="true">✓</span>}
              </div>
              <div className="tc-desc">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <h2>{vi ? "Nền trang" : "Page background"}</h2>
      <div className="bg-row" role="radiogroup" aria-label={vi ? "Màu nền" : "Background colour"}>
        {presets.map((p) => (
          <button
            key={p.id || "theme"}
            role="radio"
            aria-checked={!v.bg.color && v.bg.preset === p.id}
            className={`bg-swatch${!v.bg.color && v.bg.preset === p.id ? " on" : ""}`}
            onClick={() => setBg({ preset: p.id, color: "" })}
          >
            <span className="bg-chip" style={p.light ? { background: `linear-gradient(135deg, ${p.light} 50%, ${p.dark} 50%)` } : undefined}>{p.light ? "" : "A"}</span>
            {p.label}
          </button>
        ))}
        <label className={`bg-swatch${v.bg.color ? " on" : ""}`}>
          <span className="bg-chip" style={{ background: v.bg.color || "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />
          {vi ? "Màu khác" : "Custom"}
          <input type="color" value={v.bg.color || "#f5f0e6"} onChange={(e) => setBg({ color: e.target.value, preset: "" })} className="bg-picker" />
        </label>
      </div>
      <div className="bg-row" role="radiogroup" aria-label={vi ? "Họa tiết" : "Pattern"}>
        {patterns.map((p) => (
          <button key={p.id} role="radio" aria-checked={(v.bg.pattern || "grain") === p.id} className={`pat-swatch pat-${p.id}${(v.bg.pattern || "grain") === p.id ? " on" : ""}`} onClick={() => setBg({ pattern: p.id === "grain" ? "" : p.id })}>
            <span className="pat-chip" aria-hidden="true" />
            {p.label}
          </button>
        ))}
      </div>
      <SaveBar lang={lang} dirty={s.dirty} state={s.state} onSave={s.doSave} onCancel={s.cancel} />
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="dash-sec" id={id}>
      <h1>{title}</h1>
      {children}
    </section>
  );
}

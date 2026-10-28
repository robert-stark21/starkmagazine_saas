"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Lang = "vi" | "en";

const T = {
  vi: {
    login: "Đăng nhập",
    register: "Đăng ký",
    id: "Số điện thoại hoặc email",
    idHint: "VD: 0912 345 678 hoặc ban@gmail.com",
    name: "Tên hiển thị",
    pw: "Mật khẩu",
    pwHint: "Ít nhất 8 ký tự",
    or: "hoặc",
    google: "Tiếp tục với Google",
    googleOff: "Đăng nhập Google chưa được bật trên trang này.",
    busy: "Đang xử lý…",
    noAcc: "Chưa có tài khoản?",
    haveAcc: "Đã có tài khoản?",
    errors: {
      invalid_login: "Số điện thoại hoặc email không hợp lệ.",
      weak_password: "Mật khẩu cần ít nhất 8 ký tự.",
      taken: "Số điện thoại/email này đã có tài khoản. Hãy đăng nhập.",
      wrong: "Sai thông tin đăng nhập hoặc mật khẩu.",
      rate: "Thử quá nhiều lần. Vui lòng đợi 10 phút.",
      name: "Hãy nhập tên hiển thị.",
      google: "Đăng nhập Google không thành công. Thử lại nhé.",
      google_off: "Đăng nhập Google chưa được bật trên trang này.",
      server: "Có lỗi máy chủ. Thử lại sau ít phút.",
    } as Record<string, string>,
  },
  en: {
    login: "Sign in",
    register: "Create account",
    id: "Phone number or email",
    idHint: "e.g. 0912 345 678 or you@gmail.com",
    name: "Display name",
    pw: "Password",
    pwHint: "At least 8 characters",
    or: "or",
    google: "Continue with Google",
    googleOff: "Google sign-in is not enabled on this site.",
    busy: "Working…",
    noAcc: "No account yet?",
    haveAcc: "Already have an account?",
    errors: {
      invalid_login: "That phone number or email is not valid.",
      weak_password: "The password needs at least 8 characters.",
      taken: "This phone/email already has an account. Please sign in.",
      wrong: "Wrong login or password.",
      rate: "Too many tries. Please wait 10 minutes.",
      name: "Please enter a display name.",
      google: "Google sign-in failed. Please try again.",
      google_off: "Google sign-in is not enabled on this site.",
      server: "Server error. Please try again in a few minutes.",
    } as Record<string, string>,
  },
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AuthForm({ lang, next, google, initialError }: { lang: Lang; next: string; google: boolean; initialError?: string }) {
  const t = T[lang];
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ? t.errors[initialError] ?? t.errors.server : "");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login: f.get("login"), password: f.get("password"), name: f.get("name") }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(t.errors[j.error ?? "server"] ?? t.errors.server);
        if (j.error === "taken") setMode("login");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError(t.errors.server);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>
          {t.login}
        </button>
        <button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError(""); }}>
          {t.register}
        </button>
      </div>

      {google && (
        <>
          <a className="btn-google" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
            <GoogleIcon /> {t.google}
          </a>
          <div className="auth-or"><span>{t.or}</span></div>
        </>
      )}

      <form onSubmit={submit} className="auth-form" noValidate>
        {mode === "register" && (
          <label>
            <span>{t.name}</span>
            <input name="name" autoComplete="name" required maxLength={60} />
          </label>
        )}
        <label>
          <span>{t.id}</span>
          <input name="login" autoComplete="username" inputMode="email" placeholder={t.idHint} required />
        </label>
        <label>
          <span>{t.pw}</span>
          <input
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            placeholder={mode === "register" ? t.pwHint : undefined}
            required
          />
        </label>
        {error && <p className="auth-err" role="alert">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? t.busy : mode === "login" ? t.login : t.register}
        </button>
      </form>
      <p className="auth-switch muted small">
        {mode === "login" ? t.noAcc : t.haveAcc}{" "}
        <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? t.register : t.login}
        </button>
      </p>
    </div>
  );
}

export function LogoutButton({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.replace("/");
        router.refresh();
      }}
    >
      {lang === "vi" ? "Đăng xuất" : "Sign out"}
    </button>
  );
}

/** Header button: the reader's initial when signed in, otherwise "Sign in". */
export function AccountButton({ lang, name }: { lang: Lang; name: string | null }) {
  const label = name ? (lang === "vi" ? "Tài khoản" : "Account") : lang === "vi" ? "Đăng nhập" : "Sign in";
  return name ? (
    <Link href="/tai-khoan" className="acct on" aria-label={label} title={name}>
      {name.trim().charAt(0).toUpperCase() || "•"}
    </Link>
  ) : (
    <Link href="/dang-nhap" className="acct" aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
      <span className="acct-label">{label}</span>
    </Link>
  );
}

const savePrefs = (data: Record<string, string>) =>
  fetch("/api/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

const systemDark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

/** Header button: switches between light and dark at once (the icon follows the CSS). */
export function SchemeToggle({ scheme, lang }: { scheme: "auto" | "light" | "dark"; lang: Lang }) {
  const label = lang === "vi" ? "Đổi sáng / tối" : "Light / dark";
  const flip = () => {
    const html = document.documentElement;
    const cur = html.dataset.scheme === "auto" || !html.dataset.scheme ? (systemDark() ? "dark" : "light") : html.dataset.scheme;
    const next = cur === "dark" ? "light" : "dark";
    html.dataset.scheme = next;
    savePrefs({ scheme: next }).catch(() => {});
  };
  return (
    <button className="scheme-toggle" onClick={flip} aria-label={label} title={label} data-initial={scheme}>
      <svg className="moon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      </svg>
      <svg className="sun" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}

type OwnSec = { id: string; name: string; color: string };
type OwnSrc = { id: string; url: string; name: string; site: string; lang: string; cat: string };

const SRC_ERR: Record<string, { vi: string; en: string }> = {
  bad_url: { vi: "Địa chỉ không hợp lệ.", en: "That address is not valid." },
  blocked: { vi: "Địa chỉ này không được phép.", en: "That address is not allowed." },
  no_feed: { vi: "Không tìm thấy RSS ở trang này. Thử dán link RSS trực tiếp.", en: "No RSS feed found there. Try the feed address itself." },
  unreachable: { vi: "Không truy cập được trang này.", en: "Could not reach that site." },
  exists: { vi: "Nguồn này đã có rồi.", en: "You already added this source." },
  too_many: { vi: "Tối đa 30 nguồn.", en: "Up to 30 sources." },
  too_many_sections: { vi: "Tối đa 10 mục riêng.", en: "Up to 10 sections." },
  name: { vi: "Hãy đặt tên cho mục.", en: "Give the section a name." },
  rate: { vi: "Thử quá nhiều lần, đợi 10 phút nhé.", en: "Too many tries, wait 10 minutes." },
  bad_cat: { vi: "Chọn một mục.", en: "Pick a section." },
  server: { vi: "Có lỗi máy chủ, thử lại sau.", en: "Server error, try again later." },
};

/** Settings → Sources: add feeds to a site section or to sections the reader makes. */
export function SourcesManager({ lang, siteSections, initialSections, initialSources }: { lang: Lang; siteSections: { slug: string; label: string; color: string }[]; initialSections: OwnSec[]; initialSources: OwnSrc[] }) {
  const vi = lang === "vi";
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [sources, setSources] = useState(initialSources);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState(initialSections[0] ? `u-${initialSections[0].id}` : siteSections[0]?.slug ?? "");
  const [secName, setSecName] = useState("");

  const call = async (payload: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError("");
    try {
      const r = await fetch("/api/sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((SRC_ERR[j.error] ?? SRC_ERR.server)[lang]);
        return false;
      }
      setSections(j.sections);
      setSources(j.sources);
      router.refresh();
      return j as { sections: OwnSec[]; sources: OwnSrc[] };
    } catch {
      setError(SRC_ERR.server[lang]);
      return false;
    } finally {
      setBusy(null);
    }
  };
  const allCats = [
    ...sections.map((s) => ({ slug: `u-${s.id}`, label: `★ ${s.name}`, color: s.color })),
    ...siteSections,
  ];
  const catLabel = (slug: string) => allCats.find((c) => c.slug === slug)?.label ?? slug;

  return (
    <div className="own">
      <section className="own-block">
        <h2>{vi ? "Thêm nguồn tin" : "Add a source"}</h2>
        <p className="muted small">
          {vi ? "Dán link trang báo, blog hoặc link RSS. STARK tự tìm RSS và lấy tin mới mỗi 10 phút." : "Paste a news site, blog or RSS address. STARK finds the feed and checks it every 10 minutes."}
        </p>
        <form
          className="own-add"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!url.trim()) return;
            if (await call({ action: "add", url, cat }, "add")) setUrl("");
          }}
        >
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={vi ? "vd: genk.vn hoặc https://…/rss" : "e.g. theverge.com or https://…/feed"} inputMode="url" aria-label={vi ? "Địa chỉ nguồn" : "Source address"} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={vi ? "Thêm vào mục" : "Add to section"}>
            {sections.length > 0 && (
              <optgroup label={vi ? "Mục của tôi" : "My sections"}>
                {sections.map((s) => <option key={s.id} value={`u-${s.id}`}>{s.name}</option>)}
              </optgroup>
            )}
            <optgroup label={vi ? "Mục có sẵn" : "Site sections"}>
              {siteSections.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </optgroup>
          </select>
          <button className="btn-primary" disabled={busy === "add"}>{busy === "add" ? (vi ? "Đang tìm…" : "Finding…") : vi ? "Thêm" : "Add"}</button>
        </form>
        {error && <p className="auth-err" role="alert">{error}</p>}
      </section>

      <section className="own-block">
        <h2>{vi ? "Mục của tôi" : "My sections"}</h2>
        <p className="muted small">{vi ? "Tự tạo chuyên mục riêng, gom các nguồn bạn thích. Mục mới hiện trên menu và trang chủ." : "Make your own sections for the sources you like. They show in the menu and on the home page."}</p>
        <form
          className="own-add"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await call({ action: "section-add", name: secName }, "sec");
            if (r) {
              setSecName("");
              const made = r.sections[r.sections.length - 1];
              if (made) setCat(`u-${made.id}`);
            }
          }}
        >
          <input value={secName} onChange={(e) => setSecName(e.target.value)} placeholder={vi ? "Tên mục, vd: Xe cộ, Nấu ăn…" : "Section name, e.g. Cars, Cooking…"} maxLength={40} aria-label={vi ? "Tên mục" : "Section name"} />
          <button className="btn-ghost" disabled={busy === "sec"}>{vi ? "＋ Tạo mục" : "＋ New section"}</button>
        </form>
        {sections.length > 0 && (
          <ul className="own-list">
            {sections.map((s) => (
              <li key={s.id} style={{ ["--c" as any]: s.color }}>
                <span className="sec-dot" aria-hidden="true" />
                <a className="sec-name" href={`/c/u-${s.id}`}>{s.name}</a>
                <span className="muted small">{sources.filter((x) => x.cat === `u-${s.id}`).length} {vi ? "nguồn" : "sources"}</span>
                <button
                  className="own-x"
                  onClick={() => {
                    const name = prompt(vi ? "Tên mới" : "New name", s.name);
                    if (name && name.trim() && name !== s.name) call({ action: "section-rename", id: s.id, name }, s.id);
                  }}
                >
                  {vi ? "Đổi tên" : "Rename"}
                </button>
                <button
                  className="own-x danger"
                  onClick={() => confirm(vi ? `Xoá mục "${s.name}" và các nguồn trong đó?` : `Delete "${s.name}" and its sources?`) && call({ action: "section-remove", id: s.id }, s.id)}
                >
                  {vi ? "Xoá" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="own-block">
        <h2>{vi ? "Nguồn đã thêm" : "Your sources"} <span className="muted small">({sources.length}/30)</span></h2>
        {sources.length ? (
          <ul className="own-list">
            {sources.map((s) => (
              <li key={s.id}>
                <span className="own-src">
                  <b>{s.name}</b>
                  <small className="muted">{s.site} · {s.lang === "vi" ? "Tiếng Việt" : "English"}</small>
                </span>
                <select value={s.cat} onChange={(e) => call({ action: "move", id: s.id, cat: e.target.value }, s.id)} aria-label={vi ? "Mục" : "Section"} title={catLabel(s.cat)}>
                  {allCats.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                </select>
                <button className="own-x danger" onClick={() => call({ action: "remove", id: s.id }, s.id)} disabled={busy === s.id}>
                  {vi ? "Xoá" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{vi ? "Chưa có nguồn nào." : "No sources yet."}</p>
        )}
      </section>
    </div>
  );
}

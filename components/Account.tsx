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

type Sec = { slug: string; hidden: boolean; label: string; color: string };

/**
 * Pick the sections to read: switch each on or off and move it up or down. Every change is
 * saved at once (cookie, plus the account when signed in) and the menu updates.
 */
export function SectionsEditor({ lang, initial, defaults, signedIn }: { lang: Lang; initial: Sec[]; defaults: string[]; signedIn: boolean }) {
  const vi = lang === "vi";
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(next: Sec[]) {
    setList(next);
    setState("saving");
    try {
      const r = await fetch("/api/prefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sec: next.map((s) => (s.hidden ? "-" : "") + s.slug).join(",") }),
      });
      if (!r.ok) throw new Error();
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  }
  const toggle = (i: number) => {
    const next = list.map((s, j) => (j === i ? { ...s, hidden: !s.hidden } : s));
    if (next.every((s) => s.hidden)) return; // keep at least one section
    save(next);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const reset = () => save(list.map((s) => ({ ...s, hidden: false })).sort((a, b) => defaults.indexOf(a.slug) - defaults.indexOf(b.slug)));
  const shown = list.filter((s) => !s.hidden).length;

  return (
    <div className="sec-edit">
      <div className="sec-edit-h">
        <p className="muted small">
          {vi
            ? `Đang hiện ${shown}/${list.length} mục. ${signedIn ? "Lưu vào tài khoản của bạn, dùng được trên mọi thiết bị." : "Đang lưu trên thiết bị này. Đăng nhập để dùng trên mọi thiết bị."}`
            : `Showing ${shown}/${list.length} sections. ${signedIn ? "Saved to your account, on every device." : "Saved on this device. Sign in to use them on every device."}`}
        </p>
        <span className={`save-state ${state}`} aria-live="polite">
          {state === "saving" ? (vi ? "Đang lưu…" : "Saving…") : state === "saved" ? (vi ? "Đã lưu ✓" : "Saved ✓") : state === "error" ? (vi ? "Lỗi, thử lại" : "Error, try again") : ""}
        </span>
      </div>
      <ul>
        {list.map((s, i) => (
          <li key={s.slug} className={s.hidden ? "off" : ""} style={{ ["--c" as any]: s.color }}>
            <span className="sec-dot" aria-hidden="true" />
            <span className="sec-name">{s.label}</span>
            <span className="sec-move">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={vi ? "Lên" : "Up"}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={vi ? "Xuống" : "Down"}>↓</button>
            </span>
            <button
              role="switch"
              aria-checked={!s.hidden}
              aria-label={s.label}
              className={`switch${s.hidden ? "" : " on"}`}
              onClick={() => toggle(i)}
            >
              <i />
            </button>
          </li>
        ))}
      </ul>
      <button className="btn-ghost" onClick={reset}>{vi ? "Khôi phục mặc định" : "Reset to default"}</button>
    </div>
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

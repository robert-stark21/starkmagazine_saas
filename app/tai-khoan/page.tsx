import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton, SectionsEditor } from "@/components/Account";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { getPrefs } from "@/lib/prefs";
import { CATEGORIES } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Tài khoản & chuyên mục",
  robots: { index: false, follow: false },
};

/** Account page. Section settings work without an account too (saved on the device). */
export default async function AccountPage() {
  const [lang, session, prefs] = await Promise.all([getLang(), getSession(), getPrefs()]);
  const vi = lang === "vi";
  const bySlug = new Map(CATEGORIES.map((c) => [c.slug, c]));
  const initial = prefs.map((p) => {
    const c = bySlug.get(p.slug)!;
    return { slug: p.slug, hidden: p.hidden, label: c[lang], color: c.color };
  });

  return (
    <main className="wrap acct-page">
      <section className="acct-card">
        {session ? (
          <>
            <span className="acct big on" aria-hidden="true">{session.name.charAt(0).toUpperCase()}</span>
            <div>
              <h1>{session.name}</h1>
              <p className="muted small">{session.login}</p>
            </div>
            <LogoutButton lang={lang} />
          </>
        ) : (
          <>
            <div>
              <h1>{vi ? "Cá nhân hóa trang tin" : "Personalise your news"}</h1>
              <p className="muted small">
                {vi ? "Đăng nhập bằng số điện thoại hoặc Gmail để lưu lựa chọn trên mọi thiết bị." : "Sign in with your phone or Gmail to keep your choices on every device."}
              </p>
            </div>
            <Link className="btn-primary" href="/dang-nhap?next=/tai-khoan">{vi ? "Đăng nhập" : "Sign in"}</Link>
          </>
        )}
      </section>

      <section id="muc" className="sec-settings">
        <h2>{vi ? "Chuyên mục của bạn" : "Your sections"}</h2>
        <SectionsEditor lang={lang} initial={initial} defaults={CATEGORIES.map((c) => c.slug)} signedIn={!!session} />
      </section>
    </main>
  );
}

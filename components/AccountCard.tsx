import Link from "next/link";
import { LogoutButton } from "./Account";

/** Top of the settings pages: who is signed in, or an invitation to sign in. */
export function AccountCard({ lang, session }: { lang: "vi" | "en"; session: { name: string; login: string } | null }) {
  const vi = lang === "vi";
  return (
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
              {vi ? "Đăng nhập bằng số điện thoại hoặc Gmail để lưu lựa chọn trên mọi thiết bị và thêm nguồn tin riêng." : "Sign in with your phone or Gmail to keep your choices on every device and add your own sources."}
            </p>
          </div>
          <Link className="btn-primary" href="/dang-nhap?next=/tai-khoan">{vi ? "Đăng nhập" : "Sign in"}</Link>
        </>
      )}
    </section>
  );
}

import Link from "next/link";
import { LogoutButton } from "@/components/Account";
import { SettingsNav } from "@/components/Settings";
import { getSession } from "@/lib/auth";
import { getLang } from "@/lib/lang";

/** Settings dashboard: the reader's card and the navigation on the left, the page on the right. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [lang, session] = await Promise.all([getLang(), getSession()]);
  const vi = lang === "vi";
  return (
    <main className="wrap dash">
      <aside className="dash-side">
        <div className="dash-user">
          {session ? (
            <>
              <span className="acct big on" aria-hidden="true">{session.name.charAt(0).toUpperCase()}</span>
              <div className="dash-who">
                <b>{session.name}</b>
                <span className="muted small">{session.login}</span>
              </div>
            </>
          ) : (
            <div className="dash-who">
              <b>{vi ? "Bạn chưa đăng nhập" : "You're not signed in"}</b>
              <span className="muted small">{vi ? "Cài đặt đang lưu trên thiết bị này." : "Settings are saved on this device."}</span>
            </div>
          )}
        </div>
        <SettingsNav lang={lang} />
        <div className="dash-foot">
          {session ? (
            <LogoutButton lang={lang} />
          ) : (
            <Link className="btn-primary" href="/dang-nhap?next=/tai-khoan">{vi ? "Đăng nhập" : "Sign in"}</Link>
          )}
        </div>
      </aside>
      <div className="dash-main">{children}</div>
    </main>
  );
}

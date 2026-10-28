import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/Account";
import { getSession, googleEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/http";
import { getLang } from "@/lib/lang";

export const metadata: Metadata = {
  title: "Đăng nhập",
  robots: { index: false, follow: false },
  alternates: { canonical: "/dang-nhap" },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const to = safeNext(next, "/tai-khoan");
  if (await getSession()) redirect(to);
  const lang = await getLang();
  const vi = lang === "vi";
  return (
    <main className="wrap auth-page">
      <div className="auth-intro">
        <h1>{vi ? "Tin của riêng bạn" : "Your own front page"}</h1>
        <p className="muted">
          {vi
            ? "Đăng nhập bằng số điện thoại hoặc Gmail để chọn các chuyên mục muốn đọc, ẩn những mục không quan tâm và giữ cài đặt trên mọi thiết bị."
            : "Sign in with your phone number or Gmail to pick the sections you read, hide the rest, and keep your settings on every device."}
        </p>
      </div>
      <AuthForm lang={lang} next={to} google={googleEnabled()} initialError={error} />
    </main>
  );
}

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  serverExternalPackages: ["linkedom", "@mozilla/readability", "rss-parser"],
  // League logos in the scores ticker rarely change: let browsers keep them for a week.
  // The Interiors section became Architecture: keep old links working.
  async redirects() {
    return [
      { source: "/c/noi-that", destination: "/c/kien-truc", permanent: true },
      { source: "/giao-dien", destination: "/tai-khoan/giao-dien", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/leagues/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] }];
  },
};

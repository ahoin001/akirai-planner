import withPWA from "@ducanh2912/next-pwa";

const config = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // skipWaiting: true,
})({
  // Your other Next.js config options here
});

export default config;

// export default nextConfig;

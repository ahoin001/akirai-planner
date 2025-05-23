// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  // any other next config you have
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
};

module.exports = withPWA(nextConfig);

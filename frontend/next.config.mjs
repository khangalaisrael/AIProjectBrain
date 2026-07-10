/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone with a self-contained server and only the modules it
  // imports, so the runtime image doesn't carry node_modules. `next start` and
  // `next dev` are unaffected.
  output: "standalone",
};

export default nextConfig;

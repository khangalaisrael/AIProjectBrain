/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone with a self-contained server and only the modules it
  // imports, so the runtime image doesn't carry node_modules. `next start` and
  // `next dev` are unaffected.
  output: "standalone",
  // Import only the icons / animation helpers actually used.
  experimental: { optimizePackageImports: ["lucide-react", "framer-motion"] },
};

export default nextConfig;

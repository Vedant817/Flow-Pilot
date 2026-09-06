import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ONNX is a native Node runtime. Keep it outside webpack so Next/Vercel
  // packages only the current platform binary instead of parsing every ABI.
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-node',
    'onnxruntime-common',
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

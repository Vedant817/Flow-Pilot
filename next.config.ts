import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ONNX is a native Node runtime. Keep it outside webpack so Next/Vercel
  // packages only the current platform binary instead of parsing every ABI.
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-node',
    'onnxruntime-common',
  ],
  // Bundle the local classifier weights with the Gmail webhook function.
  outputFileTracingIncludes: {
    '/api/webhook/gmail': ['./lib/nlp/model/**/*'],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

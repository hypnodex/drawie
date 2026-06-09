/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * OpenAI API key for cloud content moderation (omni-moderation-latest).
   * When set, moderation uses OpenAI; otherwise it falls back to the local
   * nsfwjs + OCR + word-list checks. Set in `.env.local` (git-ignored).
   *
   * NOTE: a key referenced in frontend code is bundled into the client and
   * visible to users — fine for local/demo use, but production should proxy
   * the call through a small backend so the key stays server-side.
   */
  readonly VITE_OPENAI_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

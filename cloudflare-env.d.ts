declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    PLANNER_AI_MODEL?: string;
    PLANNER_AUDIO_MODEL?: string;
    TELEGRAM_BOT_TOKEN?: string;
  }
}

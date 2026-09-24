/**
 * Agent chat configuration — one chat mode, so one place for the knobs.
 *
 * Model: claude-opus-5 per docs/AGENT_CHAT_REBUILD.md §5. claude-opus-5-5 is
 * the newer, cheaper Opus and claude-sonnet-5 the cheaper swap; changing
 * either is Dave's call. Note for a switch to claude-opus-5-5: that model
 * binds thinking blocks to the exact history, and this route rewrites old
 * tool outputs (trimToolResults) and appends citation markers to text, so
 * set thinking.blockBinding to drop_block before switching.
 */
export const CHAT_MODEL = "claude-opus-5";

/** Step ceiling for one turn. stopWhen also stops on ask_question (phase 4). */
export const CHAT_MAX_STEPS = 12;

/**
 * Anthropic server-side web search: most searches one turn may run. A search
 * turn measured 2026-09-23 ran 4 searches in 45s on ~61k input tokens; 3
 * keeps chat turns quick without starving research questions.
 */
export const WEB_SEARCH_MAX_USES = 3;

/** Conversation titles: first user message, truncated. */
export const TITLE_MAX_CHARS = 50;

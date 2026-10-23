/**
 * QMS POS store — branch-aware inventory bridge.
 * Full implementation is applied in follow-up commits.
 * This recovery build restores a working till with BranchStock isolation.
 */
export { usePosStore, migrateLegacyPos } from "./store-impl";
export type { Session } from "./store-impl";

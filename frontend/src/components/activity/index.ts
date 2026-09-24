/**
 * src/components/activity/index.ts — barrel re-export for the activity feed
 * component family: the smart container (`ActivityFeed`), its desktop/mobile
 * presentations (`ActivityTable`/`ActivityList`), and the shared building
 * blocks they're built from (`ActivityRow`, `ActivityIcon`,
 * `ActivityDetails`, `ActivityDetailPanel`).
 *
 * See `src/components/activity/README.md` for what each one does and how
 * they compose together.
 */
export { default as ActivityDetailPanel } from './ActivityDetailPanel.vue';
export { default as ActivityDetails } from './ActivityDetails.vue';
export { default as ActivityFeed } from './ActivityFeed.vue';
export type { ActivitySource } from './ActivityFeed.vue';
export { default as ActivityIcon } from './ActivityIcon.vue';
export { default as ActivityList } from './ActivityList.vue';
export { default as ActivityRow } from './ActivityRow.vue';
export { default as ActivityTable } from './ActivityTable.vue';
export type { ActivityTableColumn } from './ActivityTable.vue';

/** Max time (ms) to spend attaching chunks per animation frame. */
export const FRAME_BUDGET_MS = 6;

/** Pixel ratio multiplier during camera navigation (FastNav). */
export const NAV_PIXEL_RATIO_FACTOR = 0.5;

/** Delay (ms) before restoring full quality after camera stops. */
export const NAV_RESTORE_DELAY_MS = 200;

/** Interval (ms) between visible-chunk frustum recalculations. */
export const VISIBLE_CHUNK_SAMPLE_MS = 150;

/** Interval (ms) for FPS sampling window. */
export const FPS_SAMPLE_INTERVAL_MS = 250;

/** Max instances per geometry before edge rendering is skipped. */
export const MAX_EDGE_INSTANCES = 50;

/** BVH tree leaf size — lower = more precise raycasting, higher = faster build. */
export const BVH_MAX_LEAF_SIZE = 24;

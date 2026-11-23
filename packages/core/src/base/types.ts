/** Interactivity modes. Components declare which ones they support. */
export type Mode = 'static' | 'animated' | 'interactive';

/** Resolved theme. `auto` is resolved to one of these at render time. */
export type Theme = 'dark' | 'light';

/** Component size presets. */
export type Size = 'small' | 'medium' | 'large';

/** ARIA role per mode. */
export const ROLE_BY_MODE: Record<Mode, 'figure' | 'application'> = {
  static: 'figure',
  animated: 'figure',
  interactive: 'application',
};

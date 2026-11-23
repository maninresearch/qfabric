import { type CSSResultGroup, LitElement, css, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';
import { type Mode, ROLE_BY_MODE, type Size, type Theme } from './types.js';

/**
 * Base class for every QFabric web component.
 *
 * Provides the cross-cutting concerns so individual components focus on their
 * visualization: Shadow DOM with inherited CSS-custom-property theming, mode
 * inference + ARIA roles, theme detection, reduced-motion awareness, and a
 * consistent figure shell.
 *
 * Uses Lit 3 with TC39 standard decorators. `experimentalDecorators` is never
 * enabled. Reactive properties use the `accessor` keyword accordingly.
 */
export abstract class QFElement extends LitElement {
  /** Explicit theme override; otherwise detected from ancestors / OS. */
  @property({ reflect: true }) accessor theme: Theme | 'auto' = 'auto';

  /** Size preset. */
  @property({ reflect: true }) accessor size: Size = 'medium';

  /** Bind: this component listens to `qfabric:state-update:{bind}`. */
  @property() accessor bind: string | null = null;

  /** Bind: this component is a source identified by `id`. */
  @property({ attribute: 'id', reflect: true }) accessor sourceId: string | null = null;

  /** Show the caption row (name and qubit count). Off by default. */
  @property({ attribute: 'show-label', type: Boolean }) accessor showLabel = false;

  /** Force print-friendly rendering. */
  @property({ type: Boolean, reflect: true }) accessor print = false;

  /** Resolved theme after detection. Drives a `data-resolved-theme` attribute. */
  @state() accessor resolvedTheme: Theme = 'light';

  /** Whether the user prefers reduced motion. */
  @state() accessor reducedMotion = false;

  /** Last validation error, if any. Components show a small warning dot. */
  @state() accessor warning: string | null = null;

  private _themeObserver: MutationObserver | null = null;
  private _motionQuery: MediaQueryList | null = null;
  private _schemeQuery: MediaQueryList | null = null;
  private readonly _onSchemeChange = () => this._resolveTheme();
  private readonly _onMotionChange = (e: MediaQueryListEvent) => {
    this.reducedMotion = e.matches;
  };

  /** Subclasses declare which modes they support; default is all three. */
  protected supportedModes: Mode[] = ['static', 'animated', 'interactive'];

  /** Human label shown when `showLabel` is set (overridden per component). */
  protected componentLabel = 'Component';

  /** Short context shown at the right of the caption row, e.g. `2 qubits`. */
  protected componentMeta(): string {
    return '';
  }

  /** The visualization itself; the shell, caption and warning come from here. */
  protected abstract renderState(): unknown;

  override render() {
    const meta = this.componentMeta();
    return html`
      <div class="qf-shell">
        <div class="qf-body">${this.renderState()}</div>
        ${
          this.showLabel
            ? html`<div class="qf-caption">
                <span class="qf-caption__name">${this.componentLabel}</span>
                ${meta ? html`<span>${meta}</span>` : nothing}
              </div>`
            : nothing
        }
        ${this.warning ? html`<span class="qf-warning" title=${this.warning}></span>` : nothing}
      </div>
    `;
  }

  static override styles: CSSResultGroup = css`
    :host {
      display: block;
      position: relative;
      box-sizing: border-box;
      color: var(--qf-ink, #16181d);
      font-family: var(--qf-font-sans, 'Instrument Sans', system-ui, sans-serif);
      /* Physics diagrams keep their orientation under RTL. */
      direction: ltr;
    }
    :host([size='small']) { max-width: 240px; }
    :host([size='medium']) { max-width: 400px; }
    :host([size='large']) { max-width: 100%; }

    .qf-shell {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      background: var(--qf-surface, #ffffff);
      border: 1px solid var(--qf-line, #e2e5ea);
      border-radius: var(--qf-radius, 6px);
    }
    :host(:focus-within) .qf-shell {
      outline: var(--qf-focus-ring, 2px solid #1f4e9c);
      outline-offset: 2px;
    }

    .qf-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--qf-space-2, 8px);
      padding: 18px var(--qf-space-4, 16px) 14px;
      min-width: 0;
    }

    .qf-caption {
      display: flex;
      justify-content: space-between;
      gap: var(--qf-space-2, 8px);
      padding: var(--qf-space-2, 8px) var(--qf-space-3, 12px);
      border-top: 1px solid var(--qf-line, #e2e5ea);
      font-size: var(--qf-text-xs, 12px);
      color: var(--qf-ink-muted, #5c6370);
    }
    .qf-caption__name {
      font-weight: 600;
      color: var(--qf-ink, #16181d);
    }

    .qf-warning {
      position: absolute;
      top: 8px;
      inset-inline-end: 8px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--qf-warning, #a15c00);
    }

    .qf-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this._resolveTheme();
    this._watchTheme();
    this._watchMotion();
    this._applyHostRole();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._themeObserver?.disconnect();
    this._themeObserver = null;
    this._schemeQuery?.removeEventListener('change', this._onSchemeChange);
    this._motionQuery?.removeEventListener('change', this._onMotionChange);
  }

  /** Resolve the theme before render so a `theme` change shows in the same update. */
  protected override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate(changed);
    if (changed.has('theme')) this._resolveTheme();
  }

  override updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    this.setAttribute('data-resolved-theme', this.resolvedTheme);
    this._applyHostRole();
  }

  /**
   * Infer the active mode from the component's own properties. Priority:
   * interactive > animated > static. Subclasses override this.
   */
  protected get mode(): Mode {
    return 'static';
  }

  /** Clamp the requested mode to one the component supports. */
  protected get effectiveMode(): Mode {
    const wanted = this.mode;
    if (this.supportedModes.includes(wanted)) return wanted;
    // Fall back to the highest supported mode.
    const order: Mode[] = ['interactive', 'animated', 'static'];
    return order.find((m) => this.supportedModes.includes(m)) ?? 'static';
  }

  private _applyHostRole(): void {
    this.setAttribute('role', ROLE_BY_MODE[this.effectiveMode]);
  }

  /** Theme detection, in order: the `theme` attribute, an ancestor `data-theme`, then the OS setting. */
  private _resolveTheme(): void {
    let theme: Theme;
    if (this.theme === 'dark' || this.theme === 'light') {
      theme = this.theme;
    } else {
      const ancestor = this.closest('[data-theme]')?.getAttribute('data-theme');
      if (ancestor === 'dark' || ancestor === 'light') {
        theme = ancestor;
      } else if (
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ) {
        theme = 'dark';
      } else {
        theme = 'light'; // default theme
      }
    }
    this.resolvedTheme = theme;
  }

  private _watchTheme(): void {
    if (typeof window === 'undefined') return;
    // React to data-theme changes on the document (e.g. a theme toggle).
    this._themeObserver = new MutationObserver(() => this._resolveTheme());
    const root = this.getRootNode();
    const host = root instanceof Document ? root.documentElement : (root as ShadowRoot).host;
    if (host) {
      this._themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }
    this._schemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    this._schemeQuery?.addEventListener('change', this._onSchemeChange);
  }

  private _watchMotion(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this._motionQuery.matches;
    this._motionQuery.addEventListener('change', this._onMotionChange);
  }

  /** Set a validation warning (shown as a warning dot) or clear it. */
  protected setWarning(message: string | null): void {
    this.warning = message;
    if (message) console.warn(`[qfabric] ${this.localName}: ${message}`);
  }
}

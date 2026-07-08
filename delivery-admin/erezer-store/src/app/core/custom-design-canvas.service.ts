import { Injectable, signal } from '@angular/core';
import { Canvas, FabricImage, FabricObject, IText } from 'fabric';
import type { CustomDesignImages, CustomDesignView } from './api.models';

const VIEWS: CustomDesignView[] = ['front', 'back', 'leftSleeve', 'rightSleeve'];

/** Serialized whole-studio state: the fabric objects for each view. */
type StudioState = Partial<Record<CustomDesignView, unknown>>;

/**
 * Wraps a fabric.js canvas for the custom-design studio. Keeps one object layer
 * per garment view (front/back/sleeves), swaps the mockup background per colour,
 * and can flatten each non-empty view to a PNG for the quote request.
 *
 * Provided at the component level (not root) so each studio instance is isolated
 * and torn down with the page.
 */
@Injectable()
export class CustomDesignCanvasService {
  private canvas: Canvas | null = null;
  private width = 500;
  private height = 600;

  private currentView: CustomDesignView = 'front';
  private readonly objectsByView = new Map<CustomDesignView, unknown>();
  private backgrounds: CustomDesignImages = { front: null, back: null, leftSleeve: null, rightSleeve: null };

  // Per-view undo/redo history of object snapshots.
  private history: string[] = [];
  private historyIndex = -1;
  private suppressHistory = false;

  /**
   * The garment mockup, rendered as a locked object at the back of the stack
   * (fabric v6 backgroundImage did not paint reliably here). Tagged
   * excludeFromExport so it never enters the saved design JSON, but it still
   * shows in the flattened preview (toDataURL renders the live canvas).
   */
  private mockup: FabricObject | null = null;

  /** Reactive flags the toolbar binds to. */
  readonly hasSelection = signal(false);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);
  readonly zoom = signal(1);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  init(el: HTMLCanvasElement, width = 500, height = 600): void {
    this.width = width;
    this.height = height;
    this.canvas = new Canvas(el, {
      width,
      height,
      // Neutral light-grey drawn by fabric itself, so every garment colour —
      // including white shirts — stays visible.
      backgroundColor: '#e5e7eb',
      preserveObjectStacking: true,
      selection: true,
      // Map canvas pixels 1:1 so DevTools device emulation (fake devicePixelRatio)
      // can't distort the backing store.
      enableRetinaScaling: false,
    });
    this.canvas.renderAll();

    const sync = () => this.hasSelection.set(!!this.canvas?.getActiveObject());
    this.canvas.on('selection:created', sync);
    this.canvas.on('selection:updated', sync);
    this.canvas.on('selection:cleared', sync);
    // Transform (move/scale/rotate) is a discrete undoable step.
    this.canvas.on('object:modified', () => this.pushHistory());
  }

  dispose(): void {
    this.canvas?.dispose();
    this.canvas = null;
    this.objectsByView.clear();
  }

  /**
   * Re-assert the canvas dimensions and repaint. Fabric computes its retina
   * (devicePixelRatio) transform at init time; if that happened while the canvas
   * was display:none, the background/objects render through a wrong transform and
   * appear blank. Call this once the studio becomes visible to fix it.
   */
  refreshSize(): void {
    if (!this.canvas) return;
    this.canvas.setDimensions({ width: this.width, height: this.height });
    this.canvas.renderAll();
  }

  // ── Backgrounds (garment colour) ─────────────────────────────────────────────

  /** Point every view at a colourway's mockups and refresh the current view. */
  async setBackgrounds(images: CustomDesignImages): Promise<void> {
    this.backgrounds = images;
    await this.applyBackground(this.currentView);
  }

  private async applyBackground(view: CustomDesignView): Promise<void> {
    if (!this.canvas) return;
    this.removeMockup();
    const url = this.backgrounds[view];
    if (!url) {
      this.canvas.renderAll();
      return;
    }
    try {
      const img = await this.loadImage(url);
      const scale = Math.min(this.width / (img.width || 1), this.height / (img.height || 1));
      img.set({
        originX: 'center', originY: 'center',
        left: this.width / 2, top: this.height / 2,
        scaleX: scale, scaleY: scale,
        selectable: false, evented: false, hoverCursor: 'default',
        excludeFromExport: true,
      });
      this.canvas.add(img);
      this.canvas.sendObjectToBack(img);
      this.mockup = img;
      this.canvas.renderAll();
    } catch (e) {
      console.warn('[custom-design] mockup failed to load:', url, e);
      this.canvas.renderAll();
    }
  }

  private removeMockup(): void {
    if (this.mockup && this.canvas) {
      this.canvas.remove(this.mockup);
    }
    this.mockup = null;
  }

  /**
   * Loads an image, preferring a CORS-clean load (needed so the canvas can be
   * exported to PNG on submit). If that is blocked — e.g. the same URL was cached
   * earlier by a plain <img> without CORS headers — fall back to a normal load so
   * the mockup at least displays. In that case export may taint; exportPreviews
   * handles that gracefully.
   */
  private async loadImage(url: string): Promise<FabricImage> {
    try {
      return await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
    } catch (e) {
      console.warn('[custom-design] CORS image load failed, retrying without crossOrigin:', url);
      return await FabricImage.fromURL(url);
    }
  }

  // ── View switching ───────────────────────────────────────────────────────────

  get view(): CustomDesignView {
    return this.currentView;
  }

  async setView(view: CustomDesignView): Promise<void> {
    if (!this.canvas || view === this.currentView) return;
    this.stashCurrentObjects();
    this.currentView = view;
    await this.loadObjects(this.objectsByView.get(view));
    await this.applyBackground(view);
    this.resetHistory();
  }

  /** True when a view has no user-added objects (so we skip it on submit). */
  isViewEmpty(view: CustomDesignView): boolean {
    if (view === this.currentView && this.canvas) {
      // The mockup is a locked object; ignore it when deciding "empty".
      return this.canvas.getObjects().filter((o) => o !== this.mockup).length === 0;
    }
    const state = this.objectsByView.get(view) as { objects?: unknown[] } | undefined;
    return !state?.objects || state.objects.length === 0;
  }

  private stashCurrentObjects(): void {
    if (!this.canvas) return;
    this.objectsByView.set(this.currentView, { objects: this.canvas.toObject().objects });
  }

  private async loadObjects(state: unknown): Promise<void> {
    if (!this.canvas) return;
    this.suppressHistory = true;
    const objects = (state as { objects?: unknown[] })?.objects ?? [];
    await this.canvas.loadFromJSON({ objects, version: '6' });
    this.canvas.requestRenderAll();
    this.suppressHistory = false;
  }

  // ── Add / edit objects ───────────────────────────────────────────────────────

  addText(value: string): void {
    if (!this.canvas || !value.trim()) return;
    const text = new IText(value.trim(), {
      left: this.width / 2,
      top: this.height / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 40,
      fill: '#111111',
    });
    this.canvas.add(text);
    this.canvas.setActiveObject(text);
    this.canvas.requestRenderAll();
    this.hasSelection.set(true);
    this.pushHistory();
  }

  async addImage(url: string): Promise<void> {
    if (!this.canvas) return;
    try {
      const img = await this.loadImage(url);
      const maxDim = Math.min(this.width, this.height) * 0.5;
      const scale = Math.min(maxDim / (img.width || 1), maxDim / (img.height || 1), 1);
      img.set({ left: this.width / 2, top: this.height / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
      this.canvas.add(img);
      this.canvas.setActiveObject(img);
      this.canvas.requestRenderAll();
      this.hasSelection.set(true);
      this.pushHistory();
    } catch {
      // ignore load failures; caller surfaces upload errors separately
    }
  }

  setActiveTextColor(color: string): void {
    const obj = this.canvas?.getActiveObject();
    if (obj && obj.type === 'i-text') {
      obj.set('fill', color);
      this.canvas?.requestRenderAll();
      this.pushHistory();
    }
  }

  deleteActive(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObjects();
    if (!active.length) return;
    active.forEach((o: FabricObject) => this.canvas!.remove(o));
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.hasSelection.set(false);
    this.pushHistory();
  }

  async duplicateActive(): Promise<void> {
    const obj = this.canvas?.getActiveObject();
    if (!obj || !this.canvas) return;
    const clone = await obj.clone();
    clone.set({ left: (obj.left ?? 0) + 20, top: (obj.top ?? 0) + 20 });
    this.canvas.add(clone);
    this.canvas.setActiveObject(clone);
    this.canvas.requestRenderAll();
    this.pushHistory();
  }

  bringForward(): void {
    const obj = this.canvas?.getActiveObject();
    if (obj && this.canvas) {
      this.canvas.bringObjectForward(obj);
      this.canvas.requestRenderAll();
      this.pushHistory();
    }
  }

  sendBackward(): void {
    const obj = this.canvas?.getActiveObject();
    if (obj && this.canvas) {
      this.canvas.sendObjectBackwards(obj);
      this.canvas.requestRenderAll();
      this.pushHistory();
    }
  }

  setZoom(next: number): void {
    if (!this.canvas) return;
    const clamped = Math.max(0.5, Math.min(2, next));
    this.canvas.setZoom(clamped);
    this.zoom.set(clamped);
    this.canvas.requestRenderAll();
  }

  // ── Undo / redo (per view) ────────────────────────────────────────────────────

  private resetHistory(): void {
    this.history = [this.snapshot()];
    this.historyIndex = 0;
    this.updateHistoryFlags();
  }

  private pushHistory(): void {
    if (this.suppressHistory) return;
    // Drop any redo branch, then append the new snapshot.
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(this.snapshot());
    this.historyIndex = this.history.length - 1;
    this.updateHistoryFlags();
  }

  private snapshot(): string {
    return JSON.stringify(this.canvas?.toObject().objects ?? []);
  }

  private updateHistoryFlags(): void {
    this.canUndo.set(this.historyIndex > 0);
    this.canRedo.set(this.historyIndex < this.history.length - 1);
  }

  async undo(): Promise<void> {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    await this.restore(this.history[this.historyIndex]);
  }

  async redo(): Promise<void> {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    await this.restore(this.history[this.historyIndex]);
  }

  private async restore(objectsJson: string): Promise<void> {
    if (!this.canvas) return;
    this.suppressHistory = true;
    await this.canvas.loadFromJSON({ objects: JSON.parse(objectsJson), version: '6' });
    this.canvas.requestRenderAll();
    this.suppressHistory = false;
    this.hasSelection.set(false);
    this.updateHistoryFlags();
  }

  // ── Persistence + export ───────────────────────────────────────────────────────

  /** Serializes every view's objects (not backgrounds) for drafts/resume. */
  serialize(): string {
    this.stashCurrentObjects();
    const state: StudioState = {};
    for (const v of VIEWS) {
      const objs = this.objectsByView.get(v);
      if (objs) state[v] = objs;
    }
    return JSON.stringify(state);
  }

  /** Restores a previously serialized studio state onto the current backgrounds. */
  async load(serialized: string): Promise<void> {
    let state: StudioState;
    try {
      state = JSON.parse(serialized) as StudioState;
    } catch {
      return;
    }
    this.objectsByView.clear();
    for (const v of VIEWS) {
      if (state[v]) this.objectsByView.set(v, state[v]);
    }
    await this.loadObjects(this.objectsByView.get(this.currentView));
    await this.applyBackground(this.currentView);
    this.resetHistory();
  }

  /** Flattens each non-empty view to a PNG blob (with its mockup background). */
  async exportPreviews(): Promise<{ view: CustomDesignView; blob: Blob }[]> {
    if (!this.canvas) return [];
    this.stashCurrentObjects();
    const original = this.currentView;
    const out: { view: CustomDesignView; blob: Blob }[] = [];

    for (const v of VIEWS) {
      if (this.isViewEmpty(v)) continue;
      await this.loadObjects(this.objectsByView.get(v));
      await this.applyBackground(v);
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      const blob = await this.currentCanvasBlob();
      if (blob) out.push({ view: v, blob });
    }

    // Restore what the user was looking at.
    this.currentView = original;
    await this.loadObjects(this.objectsByView.get(original));
    await this.applyBackground(original);
    return out;
  }

  /** A single flattened PNG data URL of the current view (used for the draft thumbnail). */
  thumbnailDataUrl(): string | null {
    if (!this.canvas) return null;
    try {
      return this.canvas.toDataURL({ format: 'png', multiplier: 0.5 });
    } catch {
      return null; // tainted canvas (see CORS note)
    }
  }

  private async currentCanvasBlob(): Promise<Blob | null> {
    try {
      const dataUrl = this.canvas!.toDataURL({ format: 'png', multiplier: 2 });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch {
      // Tainted canvas: mockup/artwork served without CORS headers. Surfaced upstream.
      return null;
    }
  }
}

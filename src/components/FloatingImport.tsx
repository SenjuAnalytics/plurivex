import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImportPanel } from "./ImportPanel";
import { IconImport, IconWalletImport } from "./Icons";

const STORAGE_KEY = "floating-import-pos";
const CHIP_W = 156;
const CHIP_H = 52;
const PANEL_W = 640;
const PANEL_H = 480;
const DRAG_THRESHOLD = 5;

function defaultPos() {
  return {
    x: Math.max(16, window.innerWidth - CHIP_W - 28),
    y: Math.max(16, window.innerHeight - CHIP_H - 28),
  };
}

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { x: number; y: number };
      if (typeof p.x === "number" && typeof p.y === "number") {
        return clampPos(p.x, p.y, CHIP_W, CHIP_H);
      }
    }
  } catch {
    /* ignore */
  }
  return defaultPos();
}

function clampPos(x: number, y: number, width: number, height: number) {
  const pad = 12;
  const maxX = Math.max(pad, window.innerWidth - width - pad);
  const maxY = Math.max(pad, window.innerHeight - height - pad);
  return {
    x: Math.min(Math.max(pad, x), maxX),
    y: Math.min(Math.max(pad, y), maxY),
  };
}

export function FloatingImport() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(loadPos);
  const openRef = useRef(open);
  const drag = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    width: CHIP_W,
    height: CHIP_H,
  });
  const dragHandlers = useRef({
    onMove: (_e: PointerEvent) => {},
    onUp: () => {},
  });

  openRef.current = open;

  const size = open ? { w: PANEL_W, h: PANEL_H } : { w: CHIP_W, h: CHIP_H };

  useEffect(() => {
    setPos((p) => clampPos(p.x, p.y, size.w, size.h));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, [pos]);

  useEffect(() => {
    const onResize = () => {
      const s = openRef.current ? { w: PANEL_W, h: PANEL_H } : { w: CHIP_W, h: CHIP_H };
      setPos((p) => clampPos(p.x, p.y, s.w, s.h));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        drag.current.moved = true;
      }
      setPos(clampPos(
        drag.current.origX + dx,
        drag.current.origY + dy,
        drag.current.width,
        drag.current.height,
      ));
    };

    const onUp = () => {
      if (!drag.current.active) return;
      const wasClick = !drag.current.moved && !openRef.current;
      drag.current.active = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (wasClick) setOpen(true);
    };

    dragHandlers.current = { onMove, onUp };
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent, size: { w: number; h: number }) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      width: size.w,
      height: size.h,
    };
    window.addEventListener("pointermove", dragHandlers.current.onMove);
    window.addEventListener("pointerup", dragHandlers.current.onUp);
  };

  const close = () => setOpen(false);

  const ui = (
    <div
      className={`floating-import${open ? " is-open" : ""}`}
      style={{ left: pos.x, top: pos.y }}
    >
      {!open ? (
        <button
          type="button"
          className="floating-import-chip"
          aria-label="Import wallet"
          onPointerDown={(e) => startDrag(e, { w: CHIP_W, h: CHIP_H })}
        >
          <span className="floating-import-chip-icon">
            <IconWalletImport size={22} />
          </span>
          <span className="floating-import-chip-text">
            <span className="floating-import-chip-title">Import</span>
            <span className="floating-import-chip-sub">Wallet</span>
          </span>
          <span className="floating-import-chip-action" aria-hidden>
            <IconImport size={14} />
          </span>
        </button>
      ) : (
        <div className="floating-import-panel">
          <header
            className="floating-import-header"
            onPointerDown={(e) => startDrag(e, { w: PANEL_W, h: PANEL_H })}
          >
            <span className="floating-import-header-icon">
              <IconWalletImport size={20} />
            </span>
            <div className="floating-import-header-copy">
              <h3>Import Wallets</h3>
              <p>Paste, drop files, or import raw text</p>
            </div>
            <button
              type="button"
              className="floating-import-close"
              aria-label="Close import"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={close}
            >
              ×
            </button>
          </header>
          <ImportPanel floating onClose={close} />
        </div>
      )}
    </div>
  );

  return createPortal(ui, document.body);
}
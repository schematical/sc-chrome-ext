// src/content-scripts/customWheelOffsetWidget.ts

/*
  Injects the CWO chat widget and removes existing third-party chat widgets.
  - Adds a floating launcher button (💬)
  - Toggles an iframe pointing to web-accessible chat-widget.html
  - Scans/removes common chat provider widgets and observes for dynamic inserts
*/

type Nullable<T> = T | null;

const WIDGET_IDS = {
  launcher: 'cwo-chat-launcher',
  frame: 'cwo-chat-iframe',
};

const Z_INDEX = 2147483000; // very high but below max

function isOnTargetSite(): boolean {
  return /(^|\.)customwheeloffset\.com$/i.test(location.hostname);
}

function createStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, styles);
}

function log(...args: any[]) {
  // prefix logs to find easily in console
  // eslint-disable-next-line no-console
  console.log('[CWO Widget]', ...args);
}

function removeExistingChatWidgets(root: Document | HTMLElement = document) {
  const selectors = [
    // iframes by provider
    'iframe[src*="intercom"]',
    'iframe[src*="zopim"]',
    'iframe[src*="zendesk"]',
    'iframe[src*="crisp.chat"]',
    'iframe[src*="tawk.to"]',
    'iframe[src*="drift.com"]',
    'iframe[src*="freshchat"]',
    'iframe[src*="helpscout"]',
    'iframe[src*="hubspot"]',
    // common container hints
    'div[id*="intercom"]',
    'div[class*="intercom"]',
    'div[id*="crisp"]',
    'div[class*="crisp"]',
    'div[id*="zopim"]',
    'div[id*="tawk"]',
    'div[class*="tawk"]',
    'div[id*="drift"]',
    'div[class*="hs-livechat"]',
    // explicit hubspot container
    '#hubspot-messages-iframe-container',
  ];

  const shouldRemove = (el: HTMLElement) => {
    if (el.id === WIDGET_IDS.launcher || el.id === WIDGET_IDS.frame) return false;
    // Check explicit id match first
    if (el.id === 'hubspot-messages-iframe-container') return true;
    // Fallback: selector match
    try {
      return el.matches && selectors.some((sel) => {
        try { return el.matches(sel); } catch { return false; }
      });
    } catch {
      return false;
    }
  };

  // If the root itself is an element and matches, remove it
  if ((root as HTMLElement).matches && shouldRemove(root as HTMLElement)) {
    try { (root as HTMLElement).remove(); } catch {}
  }

  // Remove any matching descendants
  const nodes = root.querySelectorAll<HTMLElement>(selectors.join(','));
  nodes.forEach((n) => {
    try { if (shouldRemove(n)) n.remove(); } catch {}
  });
}

function observeDynamicWidgets() {
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          removeExistingChatWidgets(node as HTMLElement);
        }
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

function ensureLauncher(): HTMLButtonElement {
  let btn = document.getElementById(WIDGET_IDS.launcher) as Nullable<HTMLButtonElement>;
  if (btn) return btn;

  btn = document.createElement('button');
  btn.id = WIDGET_IDS.launcher;
  btn.setAttribute('type', 'button');
  btn.setAttribute('aria-label', 'Open CWO chat');
  // Start with a safe, visible fallback (emoji + gradient)
  btn.textContent = '💬';

  const launcherBtn = btn as HTMLButtonElement;

  createStyles(launcherBtn, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    width: '48px',
    height: '48px',
    borderRadius: '24px',
    border: '1px solid rgba(0,0,0,0.15)',
    // Fallback styling (replaced if image loads)
    background: 'linear-gradient(135deg, #7b61ff, #5d2dfd)',
    color: '#fff',
    fontSize: '20px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    cursor: 'pointer',
    zIndex: String(Z_INDEX),
  });

  // Try to swap to the provided image once it's confirmed loadable
  try {
    const iconUrl = chrome.runtime.getURL('images/SchematicalSticker.png');
    const testImg = new Image();
    testImg.onload = () => {
      const launcher = launcherBtn;
      launcher.textContent = '';
      createStyles(launcher, {
        background: '#ffffff',
        backgroundImage: `url(${iconUrl})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: 'transparent',
        fontSize: '0px',
        border: '1px solid rgba(0,0,0,0.25)',
      });
    };
    testImg.onerror = () => {
      // keep fallback
    };
    testImg.src = iconUrl;
  } catch {
    // keep fallback
  }

  btn.addEventListener('mouseenter', () => {
    btn!.style.transform = 'scale(1.05)';
  });
  btn.addEventListener('mouseleave', () => {
    btn!.style.transform = 'scale(1)';
  });

  document.body.appendChild(btn);
  return btn;
}

function ensureIframe(): HTMLIFrameElement {
  let frame = document.getElementById(WIDGET_IDS.frame) as Nullable<HTMLIFrameElement>;
  if (frame) return frame;

  frame = document.createElement('iframe');
  frame.id = WIDGET_IDS.frame;
  const url = new URL(chrome.runtime.getURL('chat-widget.html'));
  url.searchParams.set('autoOpen', '1');
  frame.src = url.toString();
  frame.title = 'CWO Chat Widget';
  frame.setAttribute('aria-hidden', 'true');

  createStyles(frame, {
    position: 'fixed',
    bottom: '76px',
    right: '16px',
    width: '360px',
    height: '520px',
    maxHeight: '70vh',
    border: '0',
    borderRadius: '0',
    boxShadow: 'none',
    display: 'none',
    zIndex: String(Z_INDEX),
  });

  frame.addEventListener('load', () => log('Widget iframe loaded'));
  frame.addEventListener('error', () => log('Widget iframe load error (CSP?)'));
  document.body.appendChild(frame);
  return frame;
}

function toggleWidget(open?: boolean) {
  const frame = ensureIframe();
  const isOpen = frame.style.display !== 'none';
  const next = open ?? !isOpen;
  frame.style.display = next ? 'block' : 'none';
  frame.setAttribute('aria-hidden', String(!next));
}

function init() {
  if (!isOnTargetSite()) {
    return; // Only run on the target domain
  }

  const start = () => {
    try {
      removeExistingChatWidgets();
      observeDynamicWidgets();
      const launcher = ensureLauncher();
      ensureIframe();

      launcher.addEventListener('click', () => toggleWidget());

      // Keyboard shortcut: Ctrl+Shift+Y to toggle
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'Y' || e.key === 'y')) {
          toggleWidget();
        }
      });

      log('Widget initialized');
    } catch (err) {
      log('Initialization error', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

init();

// Ensure this file is treated as a module under isolatedModules
export {};

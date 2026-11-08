'use client';
import {useEffect, useState} from 'react';

// Full-screen school players (lessons, daily review) render into their own element at the end of
// <body> (the site's <main> isolates stacking, so a fixed overlay inside it would sit under the
// header). That element is a modal dialog, and everything else in <body> is inert while it is open:
// screen readers and the Tab key stay in the player, and the page behind comes back when it closes.
// Returns the element to portal into (null until mounted).
export default function useFullScreenDialog(label) {
  const [host, setHost] = useState(null);
  useEffect(() => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;
    document.body.appendChild(dialog);
    const behind = [...document.body.children].filter(node => node !== dialog && !node.inert && node.tagName !== 'SCRIPT');
    behind.forEach(node => { node.inert = true; });
    setHost(dialog);
    dialog.focus({preventScroll: true});
    return () => { behind.forEach(node => { node.inert = false; }); dialog.remove(); };
  }, []);
  useEffect(() => { if (host && label) host.setAttribute('aria-label', label); }, [host, label]);
  return host;
}

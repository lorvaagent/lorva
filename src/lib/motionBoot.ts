/* Kept outside the "use client" Motion module: a constant exported from a client module is not readable in a server layout. */
/** Runs before hydration: turns motion on, and off again if the app never boots, so content can never stay hidden. */
/** Theme and "pause animations" chosen earlier, applied before paint (storage keys from src/config/storage.ts: lv1.theme, lv1.still). */
export const THEME_BOOT =
  "(function(){try{var t=localStorage.getItem('lv1.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('lv1.still')==='1')document.documentElement.classList.add('still')}catch(e){}})();";
export const MOTION_BOOT =
  "(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var d=document.documentElement;d.classList.add('motion');setTimeout(function(){if(!window.__lvMotion)d.classList.remove('motion')},4000)}catch(e){}})();";

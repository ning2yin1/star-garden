'use strict';
// Relative URLs keep both the worker and manifest inside the Pages subpath.
// Registration failure must not prevent the normal online game from running.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'})
      .catch(error => console.warn('Offline setup could not complete:', error));
  });
}

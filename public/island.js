/**
 * Dynamic Island Apple Fluid Interaction
 * Memberikan animasi haptik & transisi pembuka aplikasi iPhone saat mengeklik header
 */
(function() {
  function initDynamicIsland() {
    const brandTitle = document.querySelector('.brand-title');
    const appHeader = document.querySelector('header.app-header');

    if (brandTitle && appHeader) {
      brandTitle.addEventListener('click', function(e) {
        const targetUrl = brandTitle.getAttribute('href');
        const currentPath = window.location.pathname;
        const isCurrentPage = (!targetUrl || targetUrl === currentPath || (targetUrl === '/' && (currentPath === '/' || currentPath === '/index.html')));

        // Berikan efek buka aplikasi iPhone pada kapsul Dynamic Island
        appHeader.classList.remove('island-launching');
        void appHeader.offsetWidth; // trigger reflow
        appHeader.classList.add('island-launching');

        if (!isCurrentPage && targetUrl) {
          e.preventDefault();
          setTimeout(function() {
            window.location.href = targetUrl;
          }, 180);
        } else {
          setTimeout(function() {
            appHeader.classList.remove('island-launching');
          }, 400);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDynamicIsland);
  } else {
    initDynamicIsland();
  }
})();

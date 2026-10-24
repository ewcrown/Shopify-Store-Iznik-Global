(function() {
  var SELECTORS = {
    container: '#ProductGridContainer',
    collection: '.collection',
    grid: '#product-grid',
    item: '#product-grid > li',
    status: '[data-infinite-scroll-status]',
    pagination: '.pagination-wrapper'
  };

  var loading = false;
  var nextUrl = '';
  var observer = null;
  var initializedContainer = null;

  function getContainer() {
    return document.querySelector(SELECTORS.container);
  }

  function getStatus(container) {
    return container ? container.querySelector(SELECTORS.status) : null;
  }

  function setStatusLoading(status, isLoading) {
    if (!status) return;
    status.classList.toggle('hidden', !isLoading);
    status.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }

  function getNextUrlFrom(container) {
    var status = getStatus(container);
    return status ? status.dataset.nextUrl || '' : '';
  }

  function markEnabled(container) {
    var collection = container.querySelector(SELECTORS.collection);
    if (collection) collection.classList.add('collection-infinite-scroll-enabled');
  }

  function markDisabled(container) {
    var collection = container ? container.querySelector(SELECTORS.collection) : null;
    if (collection) collection.classList.remove('collection-infinite-scroll-enabled');
  }

  function updatePaginationState(nextContainer) {
    var currentStatus = getStatus(getContainer());
    var nextStatus = getStatus(nextContainer);
    var currentPagination = document.querySelector(SELECTORS.pagination);
    var nextPagination = nextContainer ? nextContainer.querySelector(SELECTORS.pagination) : null;

    nextUrl = nextStatus ? nextStatus.dataset.nextUrl || '' : '';

    if (currentStatus && nextStatus) {
      currentStatus.dataset.currentPage = nextStatus.dataset.currentPage || currentStatus.dataset.currentPage || '';
      currentStatus.dataset.totalPages = nextStatus.dataset.totalPages || currentStatus.dataset.totalPages || '';
      currentStatus.dataset.nextUrl = nextUrl;
    }

    if (currentPagination && nextPagination) {
      currentPagination.innerHTML = nextPagination.innerHTML;
      currentPagination.dataset.page = nextPagination.dataset.page || currentPagination.dataset.page || '';
    }
  }

  function appendProductsFrom(htmlText) {
    var parsed = new DOMParser().parseFromString(htmlText, 'text/html');
    var nextContainer = parsed.querySelector(SELECTORS.container);
    var currentGrid = document.querySelector(SELECTORS.grid);
    var newItems = parsed.querySelectorAll(SELECTORS.item);

    if (!nextContainer || !currentGrid || !newItems.length) {
      nextUrl = '';
      return;
    }

    newItems.forEach(function(item) {
      currentGrid.appendChild(document.importNode(item, true));
    });

    updatePaginationState(nextContainer);

    if (typeof initializeScrollAnimationTrigger === 'function') {
      initializeScrollAnimationTrigger();
    }
  }

  function loadNextPage() {
    var container = getContainer();
    var status = getStatus(container);

    if (loading || !nextUrl) return;

    loading = true;
    setStatusLoading(status, true);

    fetch(nextUrl, { credentials: 'same-origin' })
      .then(function(response) {
        if (!response.ok) throw new Error('Collection page request failed');
        return response.text();
      })
      .then(appendProductsFrom)
      .catch(function() {
        markDisabled(container);
        nextUrl = '';
      })
      .finally(function() {
        loading = false;
        setStatusLoading(status, false);
        if (nextUrl && isNearBottom()) loadNextPage();
      });
  }

  function isNearBottom() {
    var grid = document.querySelector(SELECTORS.grid);
    if (!grid) return false;

    var rect = grid.getBoundingClientRect();
    return rect.bottom - window.innerHeight < 800;
  }

  function onScroll() {
    if (isNearBottom()) loadNextPage();
  }

  function initInfiniteScroll() {
    var container = getContainer();
    var status = getStatus(container);
    if (!container) return;

    if (status && parseInt(status.dataset.totalPages || '0', 10) > 1) {
      markEnabled(container);
    }

    nextUrl = getNextUrlFrom(container);
    if (!nextUrl) {
      window.removeEventListener('scroll', onScroll);
      return;
    }

    initializedContainer = container;

    window.removeEventListener('scroll', onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function observeCollectionChanges() {
    var container = getContainer();
    if (!container || observer) return;

    observer = new MutationObserver(function() {
      if (initializedContainer !== container || getNextUrlFrom(container) !== nextUrl) {
        initInfiniteScroll();
      }
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', function() {
    initInfiniteScroll();
    observeCollectionChanges();
  });

  document.addEventListener('shopify:section:load', function() {
    initInfiniteScroll();
    observeCollectionChanges();
  });
})();

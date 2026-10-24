(() => {
  const initialized = new WeakSet();
  const observedContainers = new WeakSet();

  const initSlider = (slider) => {
    if (initialized.has(slider)) return;
    const images = [...slider.querySelectorAll('.card-image-slider__image')];
    if (images.length < 2) return;
    initialized.add(slider);

    const cardInner = slider.closest('.card__inner');
    const gestureSurface = cardInner?.querySelector('.card-image-slider__controls') || slider;
    const productLink = slider.closest('.card-wrapper')?.querySelector('.card__heading a');
    let index = 0;
    let pointerDown = false;
    let startX = 0;
    let startY = 0;
    let dragged = false;
    let cancelLinkClick = false;

    const showImage = (nextIndex) => {
      index = (nextIndex + images.length) % images.length;
      images.forEach((image, imageIndex) => image.classList.toggle('is-active', imageIndex === index));
    };

    const arrowButtons = cardInner?.querySelectorAll('[data-slider-direction]') || [];
    arrowButtons.forEach((button) => {
      button.addEventListener('pointerdown', (event) => event.stopPropagation());
    });

    gestureSurface.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerDown = true;
      cancelLinkClick = false;
      dragged = false;
      startX = event.clientX;
      startY = event.clientY;
      gestureSurface.setPointerCapture?.(event.pointerId);
    });

    gestureSurface.addEventListener('pointermove', (event) => {
      if (!pointerDown) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
        dragged = true;
        event.preventDefault();
      }
    });

    const finishPointer = (event) => {
      if (!pointerDown) return;
      const deltaX = event.clientX - startX;
      if (dragged && Math.abs(deltaX) > 35) {
        showImage(index + (deltaX < 0 ? 1 : -1));
        cancelLinkClick = true;
      }
      pointerDown = false;
      startX = 0;
      startY = 0;
    };

    gestureSurface.addEventListener('pointerup', finishPointer);
    gestureSurface.addEventListener('pointercancel', finishPointer);
    gestureSurface.addEventListener('click', (event) => {
      const arrow = event.target instanceof Element ? event.target.closest('[data-slider-direction]') : null;
      if (arrow) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showImage(index + (arrow.dataset.sliderDirection === 'next' ? 1 : -1));
        return;
      }
      if (cancelLinkClick) {
        event.preventDefault();
        event.stopPropagation();
        cancelLinkClick = false;
        return;
      }
      productLink?.click();
    }, true);
  };

  const init = (root = document) => {
    if (root.nodeType === 1 && root.matches('[data-card-image-slider]')) initSlider(root);
    root.querySelectorAll?.('[data-card-image-slider]').forEach(initSlider);
  };

  const observeProductGrid = () => {
    document.querySelectorAll('#ProductGridContainer, product-recommendations').forEach((container) => {
      if (observedContainers.has(container)) return;
      observedContainers.add(container);
      new MutationObserver((mutations) => {
        mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) init(node);
        }));
      }).observe(container, { childList: true, subtree: true });
    });
  };

  const start = (root = document) => { init(root); observeProductGrid(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(), { once: true });
  else start();
  document.addEventListener('shopify:section:load', (event) => start(event.target));
})();

if (!customElements.get('quick-add-modal')) {
  customElements.define(
    'quick-add-modal',
    class QuickAddModal extends ModalDialog {
      constructor() {
        super();
        this.modalContent = this.querySelector('[id^="QuickAddInfo-"]');

        this.addEventListener('product-info:loaded', ({ target }) => {
          target.addPreProcessCallback(this.preprocessHTML.bind(this));
        });
      }

      hide(preventFocus = false) {
        const cartNotification = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        if (cartNotification) cartNotification.setActiveElement(this.openedBy);
        this.mediaObserver?.disconnect();
        this.mediaObserver = null;
        this.modalContent.innerHTML = '';

        if (preventFocus) this.openedBy = null;
        super.hide();
      }

      show(opener) {
        opener.setAttribute('aria-disabled', true);
        opener.classList.add('loading');
        opener.querySelector('.loading__spinner').classList.remove('hidden');

        fetch(opener.getAttribute('data-product-url'))
          .then((response) => response.text())
          .then((responseText) => {
            const responseHTML = new DOMParser().parseFromString(responseText, 'text/html');
            const productElement = responseHTML.querySelector('product-info');

            this.preprocessHTML(productElement);
            HTMLUpdateUtility.setInnerHTML(this.modalContent, productElement.outerHTML);
            this.positionAddOnsAfterPrice(this.modalContent);

            if (window.Shopify && Shopify.PaymentButton) {
              Shopify.PaymentButton.init();
            }
            if (window.ProductModel) window.ProductModel.loadShopifyXR();

            super.show(opener);
            requestAnimationFrame(() => {
              this.initializeQuickAddGallery();
              this.initializeDeferredMedia();
              this.positionAddOnsAfterPrice(this.modalContent);
            });
          })
          .finally(() => {
            opener.removeAttribute('aria-disabled');
            opener.classList.remove('loading');
            opener.querySelector('.loading__spinner').classList.add('hidden');
          });
      }

      initializeDeferredMedia() {
        this.mediaObserver?.disconnect();

        const slides = this.modalContent.querySelectorAll('.product__media-item');
        this.mediaObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const deferredMedia = entry.target.querySelector('deferred-media');
              if (!deferredMedia) return;

              if (entry.isIntersecting) {
                deferredMedia.loadContent(false);
                requestAnimationFrame(() => {
                  const video = deferredMedia.querySelector('video');
                  if (!video) return;
                  video.muted = true;
                  video.play().catch(() => {});
                });
              } else {
                deferredMedia.querySelector('video')?.pause();
              }
            });
          },
          { threshold: 0.45 }
        );

        slides.forEach((slide) => {
          if (slide.querySelector('deferred-media')) this.mediaObserver.observe(slide);
        });
      }

      initializeQuickAddGallery() {
        const gallery = this.modalContent.querySelector('media-gallery');
        const slider = gallery?.querySelector('[id^="Slider-Gallery-"]');
        const dots = Array.from(gallery?.querySelectorAll('.dot-item') || []);
        if (!slider || !dots.length) return;

        const getSlides = () => Array.from(slider.querySelectorAll('.product__media-item'));
        const updateDots = () => {
          const slides = getSlides();
          if (!slides.length) return;

          const activeIndex = slides.reduce((closestIndex, slide, index) => {
            const closestDistance = Math.abs(slides[closestIndex].offsetLeft - slider.scrollLeft);
            const distance = Math.abs(slide.offsetLeft - slider.scrollLeft);
            return distance < closestDistance ? index : closestIndex;
          }, 0);

          dots.forEach((dot, index) => {
            const isActive = index === activeIndex;
            dot.classList.toggle('active', isActive);
            if (isActive) {
              dot.setAttribute('aria-current', 'true');
            } else {
              dot.removeAttribute('aria-current');
            }
          });
        };

        let scrollFrame;
        slider.addEventListener('scroll', () => {
          cancelAnimationFrame(scrollFrame);
          scrollFrame = requestAnimationFrame(updateDots);
        }, { passive: true });

        dots.forEach((dot, index) => {
          dot.addEventListener('click', () => {
            const slide = getSlides()[index];
            if (!slide) return;
            slider.scrollTo({
              left: slide.offsetLeft,
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            });
          });
        });

        updateDots();
      }

      preprocessHTML(productElement) {
        productElement.classList.forEach((classApplied) => {
          if (classApplied.startsWith('color-') || classApplied === 'gradient')
            this.modalContent.classList.add(classApplied);
        });
        this.preventDuplicatedIDs(productElement);
        this.removeDOMElements(productElement);
        this.removeGalleryListSemantic(productElement);
        this.updateImageSizes(productElement);
        this.preventVariantURLSwitching(productElement);
        this.positionAddOnsAfterPrice(productElement);
      }

      positionAddOnsAfterPrice(container) {
        if (!container) return;

        const addOns = container.querySelector('variant-add-on-products, .variant-add-ons');
        const price = container.querySelector('[id^="price-"]');

        if (price && addOns && price.nextElementSibling !== addOns) {
          price.after(addOns);
        }
      }

      preventVariantURLSwitching(productElement) {
        productElement.setAttribute('data-update-url', 'false');
      }

      removeDOMElements(productElement) {
        const pickupAvailability = productElement.querySelector('pickup-availability');
        if (pickupAvailability) pickupAvailability.remove();

        const productModal = productElement.querySelector('product-modal');
        if (productModal) productModal.remove();

        const modalDialog = productElement.querySelectorAll('modal-dialog');
        if (modalDialog) modalDialog.forEach((modal) => modal.remove());
      }

      preventDuplicatedIDs(productElement) {
        const sectionId = productElement.dataset.section;

        const oldId = sectionId;
        const newId = `quickadd-${sectionId}`;
        productElement.innerHTML = productElement.innerHTML.replaceAll(oldId, newId);
        Array.from(productElement.attributes).forEach((attribute) => {
          if (attribute.value.includes(oldId)) {
            productElement.setAttribute(attribute.name, attribute.value.replace(oldId, newId));
          }
        });

        productElement.dataset.originalSection = sectionId;
      }

      removeGalleryListSemantic(productElement) {
        const galleryList = productElement.querySelector('[id^="Slider-Gallery"]');
        if (!galleryList) return;

        galleryList.setAttribute('role', 'presentation');
        galleryList.querySelectorAll('[id^="Slide-"]').forEach((li) => li.setAttribute('role', 'presentation'));
      }

      updateImageSizes(productElement) {
        const product = productElement.querySelector('.product');
        const desktopColumns = product?.classList.contains('product--columns');
        if (!desktopColumns) return;

        const mediaImages = product.querySelectorAll('.product__media img');
        if (!mediaImages.length) return;

        let mediaImageSizes =
          '(min-width: 1000px) 715px, (min-width: 750px) calc((100vw - 11.5rem) / 2), calc(100vw - 4rem)';

        if (product.classList.contains('product--medium')) {
          mediaImageSizes = mediaImageSizes.replace('715px', '605px');
        } else if (product.classList.contains('product--small')) {
          mediaImageSizes = mediaImageSizes.replace('715px', '495px');
        }

        mediaImages.forEach((img) => img.setAttribute('sizes', mediaImageSizes));
      }
    }
  );
}

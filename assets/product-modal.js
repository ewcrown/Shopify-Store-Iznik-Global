if (!customElements.get('product-modal')) {
  customElements.define(
    'product-modal',
    class ProductModal extends ModalDialog {
      constructor() {
        super();
        this.querySelector('[data-modal-previous]')?.addEventListener('click', () => this.changeMedia(-1));
        this.querySelector('[data-modal-next]')?.addEventListener('click', () => this.changeMedia(1));
        this.querySelector('[data-modal-close]')?.addEventListener('click', () => {
          this.querySelector('[id^="ModalClose-"]')?.click();
        });
        this.querySelector('.product-media-modal__controls')?.addEventListener('pointerup', (event) => {
          event.stopPropagation();
        });
      }

      hide() {
        super.hide();
      }

      show(opener) {
        super.show(opener);
        this.showActiveMedia();
      }

      showActiveMedia() {
        this.querySelectorAll(
          `[data-media-id]:not([data-media-id="${this.openedBy.getAttribute('data-media-id')}"])`
        ).forEach((element) => {
          element.classList.remove('active');
        });
        const activeMedia = this.querySelector(`[data-media-id="${this.openedBy.getAttribute('data-media-id')}"]`);
        const activeMediaTemplate = activeMedia.querySelector('template');
        const activeMediaContent = activeMediaTemplate ? activeMediaTemplate.content : null;
        activeMedia.classList.add('active');

        const container = this.querySelector('[role="document"]');
        if (window.matchMedia('(max-width: 749px)').matches) {
          activeMedia.scrollIntoView({ block: 'nearest', inline: 'start' });
          container.scrollTo({ left: activeMedia.offsetLeft, behavior: 'auto' });
        } else {
          container.scrollLeft = (activeMedia.width - container.clientWidth) / 2;
        }

        if (
          activeMedia.nodeName == 'DEFERRED-MEDIA' &&
          activeMediaContent &&
          activeMediaContent.querySelector('.js-youtube')
        )
          activeMedia.loadContent();
      }

      changeMedia(direction) {
        const mediaItems = [...this.querySelectorAll('.product-media-modal__content > [data-media-id]')];
        if (mediaItems.length < 2) return;

        const activeIndex = Math.max(0, mediaItems.findIndex((item) => item.classList.contains('active')));
        const nextIndex = (activeIndex + direction + mediaItems.length) % mediaItems.length;
        mediaItems.forEach((item) => item.classList.remove('active'));

        const nextMedia = mediaItems[nextIndex];
        nextMedia.classList.add('active');
        this.querySelector('[role="document"]').scrollTo({
          left: nextMedia.offsetLeft,
          behavior: 'smooth',
        });

        if (nextMedia.nodeName === 'DEFERRED-MEDIA' && nextMedia.querySelector('template')) {
          nextMedia.loadContent();
        }
      }
    }
  );
}

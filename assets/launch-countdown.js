(() => {
  const roots = new Set();
  const savedControls = new WeakMap();
  const timers = new WeakMap();

  function buildTimer(timer) {
    if (timer.dataset.timerBuilt === 'true') return;

    const heading = document.createElement('span');
    heading.className = 'launch-countdown__heading';
    heading.dataset.launchHeading = '';

    const units = document.createElement('span');
    units.className = 'launch-countdown__units';

    [['days', 'Days'], ['hours', 'Hours'], ['minutes', 'Minutes'], ['seconds', 'Seconds']].forEach(([unit, label]) => {
      const item = document.createElement('span');
      item.className = 'launch-countdown__unit';

      const value = document.createElement('span');
      value.className = 'launch-countdown__value';
      value.dataset.launchUnit = unit;

      const name = document.createElement('span');
      name.className = 'launch-countdown__label';
      name.textContent = label;

      item.append(value, name);
      units.append(item);
    });

    timer.append(heading, units);
    timer.dataset.timerBuilt = 'true';
  }

  function getControls(root) {
    return Array.from(root.querySelectorAll('button[name="add"], .shopify-payment-button, quick-add-bulk'))
      .filter((control) => {
        if (control.closest('[data-launch-product]') !== root) return false;
        return !control.closest('modal-opener[data-product-url]');
      });
  }

  function saveControl(control, root) {
    if (savedControls.has(control)) return savedControls.get(control);

    const variantInput = control.closest('form')?.querySelector('.product-variant-id');
    const state = {
      html: control.innerHTML,
      disabled: 'disabled' in control
        ? root.hasAttribute('data-launch-pending')
          ? control.dataset.launchBaseDisabled === 'true' || Boolean(variantInput?.disabled)
          : control.disabled
        : false,
      variantId: variantInput?.value,
      hidden: control.hidden,
    };
    savedControls.set(control, state);
    return state;
  }

  function updateRoot(root) {
    const launchAt = Number(root.dataset.launchAt);
    if (!Number.isFinite(launchAt) || launchAt <= 0) return;

    const remaining = launchAt - Date.now();
    const active = remaining > 0;
    root.toggleAttribute('data-launch-pending', active);
    const label = remaining > 24 * 60 * 60 * 1000 ? 'Launching Tomorrow' : 'Launching Today';
    const timer = timers.get(root) || root.querySelector('[data-launch-countdown]');

    if (timer) {
      buildTimer(timer);
      if (!active) {
        timer.hidden = true;
      } else {
        const totalSeconds = Math.floor(remaining / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (value) => String(value).padStart(2, '0');
        timer.querySelector('[data-launch-heading]').textContent = `${label}${days > 0 ? ` · ${days}d` : ''}`;
        timer.querySelector('[data-launch-unit="days"]').textContent = days;
        timer.querySelector('[data-launch-unit="hours"]').textContent = pad(hours);
        timer.querySelector('[data-launch-unit="minutes"]').textContent = pad(minutes);
        timer.querySelector('[data-launch-unit="seconds"]').textContent = pad(seconds);
        timer.hidden = false;
      }
    }

    getControls(root).forEach((control) => {
      const original = saveControl(control, root);
      if (control.matches('.shopify-payment-button, quick-add-bulk')) {
        control.hidden = active || original.hidden;
      } else if (active) {
        control.disabled = true;
        control.textContent = label;
        control.setAttribute('aria-disabled', 'true');
      } else {
        control.innerHTML = original.html;
        const variantInput = control.closest('form')?.querySelector('.product-variant-id');
        control.disabled = variantInput
          ? Boolean(variantInput.disabled) || (variantInput.value === original.variantId && original.disabled)
          : original.disabled;
        control.removeAttribute('aria-disabled');
      }
    });
  }

  function register(root) {
    if (roots.has(root)) return;
    roots.add(root);

    root.addEventListener('submit', (event) => {
      if (
        event.target.closest('[data-launch-product]') === root &&
        Number(root.dataset.launchAt) > Date.now()
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    const timer = root.querySelector('[data-launch-countdown]');
    if (timer) timers.set(root, timer);
    const buttons = root.querySelector('.product-form__buttons');
    if (timer && buttons) buttons.before(timer);

    updateRoot(root);
  }

  function scan(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches('[data-launch-product]')) register(node);
    node.querySelectorAll('[data-launch-product]').forEach(register);
  }

  function start() {
    document.querySelectorAll('[data-launch-product]').forEach(register);
    window.setInterval(() => {
      roots.forEach((root) => {
        if (!root.isConnected) roots.delete(root);
        else updateRoot(root);
      });
    }, 1000);
    new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(scan));
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
export function initSkin() {
  if (document.readyState === 'loading') {
    let listener = () => {
      init();
      document.removeEventListener('DOMContentLoaded', listener);
    }
    document.addEventListener('DOMContentLoaded', listener);
  } else init();
}

function init() {
  // removeBanners();
  customizeStyles();
}

function removeBanners() {
  let banner = document.querySelector('#banner_skyscraper');
  if (banner) banner.remove();
}

function customizeStyles() {
  document.body.style.overflowY = 'auto';
  ((window as any)['siteFooter'] as HTMLElement).style.zIndex = '10';
}

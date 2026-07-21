/**
 * Meta Pixel for OxyHyperbaric (1934798400510737).
 * Loaded on every public page. Safe to include twice — fbq stub no-ops.
 */
(function () {
  var PIXEL_ID = '1934798400510737';
  if (window.__oxyMetaPixelLoaded) return;
  window.__oxyMetaPixelLoaded = true;

  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  try {
    var path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    if (path === '/hyperbaric') {
      fbq('track', 'ViewContent', {
        content_name: 'Hyperbaric First Session',
        content_category: 'wellness'
      });
    } else if (path === '/infrabaldan') {
      fbq('track', 'ViewContent', {
        content_name: 'Red Light InfraBaldan',
        content_category: 'wellness'
      });
    }
  } catch (e) {}
})();

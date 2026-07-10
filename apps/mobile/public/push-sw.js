/* Handlers de Web Push, importados pelo service worker do app (workbox importScripts). */
self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Meu Mercado', body: event.data ? event.data.text() : '' };
  }
  var title = data.title || 'Meu Mercado';
  var options = {
    body: data.body || '',
    icon: '/pwa-512x512.png',
    badge: '/pwa-512x512.png',
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Avisa o app aberto para reconsultar o plano na hora (ex.: Pro liberado).
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          list[i].postMessage({ type: 'mm-refresh-billing' });
        }
      }),
    ]),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

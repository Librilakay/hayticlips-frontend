// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBhIdds8Q7YR_F1h6dTLWDby-OvLgArCSk",
  authDomain: "tstx-58474.firebaseapp.com",
  projectId: "tstx-58474"
});

const messaging = firebase.messaging();

// Gestion des notifications en arrière-plan (quand l'onglet est fermé ou non actif)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notification reçue en arrière-plan:', payload);

  const notificationTitle = payload.notification?.title || "HaytiClips";
  const notificationOptions = {
    body: payload.notification?.body || "Vous avez reçu une nouvelle notification.",
    icon: payload.notification?.icon || "/icon-192.png", // Met le lien de ton icône ici
    badge: "/icon.png",
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Événement au clic sur la notification push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Redirection selon les données transmises
  let targetUrl = '/notif.html';
  if (event.notification.data) {
    if (event.notification.data.videoId) targetUrl = `/feed.html?videoId=${event.notification.data.videoId}`;
    else if (event.notification.data.conversationId) targetUrl = `/chat.html?conv=${event.notification.data.conversationId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
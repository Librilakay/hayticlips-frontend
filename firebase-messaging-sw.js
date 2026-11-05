// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBhIdds8Q7YR_F1h6dTLWDby-OvLgArCSk",
  authDomain: "tstx-58474.firebaseapp.com",
  projectId: "tstx-58474",
  storageBucket: "tstx-58474.firebasestorage.app",
  messagingSenderId: "1010020144942",
  appId: "1:1010020144942:web:9b7d15db2bda42af9f8cbf"
};

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("notificationclick", event => {
  const data = event.notification.data;

  if (data?.hcPushKind !== "gift-v1") return;

  event.stopImmediatePropagation();
  event.notification.close();

  const url = new URL(
    data.videoId ? "/feed.html" : "/notif.html",
    self.location.origin
  );

  if (data.videoId) {
    url.searchParams.set("videoId", data.videoId);
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    const existing = windows.find(
      client => client.url === url.href
    );

    if (existing) return existing.focus();

    return self.clients.openWindow(url.href);
  })());
});

self.addEventListener("push", event => {
  let payload;

  try {
    payload = event.data?.json();
  } catch {
    return;
  }

  const data = payload?.data;

  if (payload?.notification || data?.hcPushKind !== "gift-v1") {
    return;
  }

  event.stopImmediatePropagation();

  event.waitUntil(self.registration.showNotification(
    data.pushTitle || "Nouveau cadeau 🎁",
    {
      body: data.pushBody || "Tu as reçu un cadeau sur HaytiClips.",
      icon: "/icons/icon-192.jpg",
      data: {
        hcPushKind: "gift-v1",
        videoId: data.videoId || ""
      }
    }
  ));
});

importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"
);

firebase.initializeApp(firebaseConfig);
firebase.messaging();
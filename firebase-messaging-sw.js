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

function isHaytiPush(data) {
  return data?.hcPushKind === "gift-v1" ||
    (data?.hcPushKind === "event-v1" && [
      "follow", "like", "comment", "reply",
      "merchant_order", "merchant_order_accepted"
    ].includes(data.type));
}

function pushDestination(data) {
  const url = new URL("/notif.html", self.location.origin);

  if (data.type === "follow" && data.uid) {
    url.pathname = "/profil.html";
    url.searchParams.set("uid", data.uid);
  } else if (data.type === "merchant_order") {
    url.pathname = "/merchant-dashboard.html";
  } else if (data.type === "merchant_order_accepted" && data.merchantUid) {
    url.pathname = "/merchant-products.html";
    url.searchParams.set("uid", data.merchantUid);
    url.searchParams.set("tab", "orders");
  } else if (data.videoId) {
    url.pathname = "/feed.html";
    url.searchParams.set("videoId", data.videoId);
  }

  return url.href;
}

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("notificationclick", event => {
  const data = event.notification.data;
  if (!isHaytiPush(data)) return;

  event.stopImmediatePropagation();
  event.notification.close();

  const url = pushDestination(data);

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window", includeUncontrolled: true
    });

    const existing = windows.find(client => client.url === url);

    return existing ? existing.focus() : self.clients.openWindow(url);
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
  if (payload?.notification || !isHaytiPush(data)) return;

  event.stopImmediatePropagation();

  event.waitUntil(self.registration.showNotification(
    data.pushTitle || "HaytiClips",
    {
      body: data.pushBody || "Tu as reçu une notification.",
      icon: "/icons/icon-192.jpg",
      data: {
        hcPushKind: data.hcPushKind,
        type: data.type || "",
        uid: data.uid || "",
        videoId: data.videoId || "",
        merchantUid: data.merchantUid || ""
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
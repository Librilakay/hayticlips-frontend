/* ================= IMPORTS ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth, onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  startAfter,
  orderBy,
  getDocs,
  doc,
  limit,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyBhIdds8Q7YR_F1h6dTLWDby-OvLgArCSk",
  authDomain: "tstx-58474.firebaseapp.com",
  projectId: "tstx-58474",
  storageBucket: "tstx-58474.firebasestorage.app",
  messagingSenderId: "1010020144942",
  appId: "1:1010020144942:web:9b7d15db2bda42af9f8cbf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

  
  function formatNumber(num) {
  if (!num) return "0";

  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(".0", "") + "B";
  }

  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(".0", "") + "M";
  }

  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(".0", "") + "K";
  }

  return num.toString();
}

/* ================= GLOBALS ================= */
let currentUser = null;
let currentVideoId = null;
let replyingToCommentId = null;
let selectedReportReason = null;
let lastDoc = null;
let loading = false;
let hasMoreDocs = true;
const userCache = {};

/* ================= PUSH NOTIFICATIONS ================= */
async function triggerPushNotification(targetUid, title, body, extraData = {}) {
  // On n'envoie pas de push à soi-même
  if (!auth.currentUser || targetUid === auth.currentUser.uid) return;
  
  try {
    const token = await auth.currentUser.getIdToken();
    await fetch("https://hayticlip-server.onrender.com/api/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ targetUid, title, body, extraData })
    });
  } catch (e) {
    console.error("Erreur déclenchement push :", e);
  }
}


// 🔑 AUTH

onAuthStateChanged(auth, async user => {
  console.log("auth state:", user);

  const currentPage = window.location.pathname.split("/").pop();
  const params = new URLSearchParams(window.location.search);
  const sharedVideoId = params.get("videoId");

  if (!user || user.isAnonymous) {
    const redirectUrl = sharedVideoId
      ? `login.html?redirect=feed.html&videoId=${encodeURIComponent(sharedVideoId)}`
      : "login.html";

    window.location.href = redirectUrl;
    return;
  }

  console.log(await user.getIdToken());
  if (!user.emailVerified) {
  window.location.href = "verify.html";
  return;
}
  
  try {
  await updateDoc(doc(db,"users",user.uid),{
    online:true,
    lastActive: serverTimestamp()
  });
} catch (e) {
  console.log("User doc n'existe pas encore, création...");
await setDoc(doc(db,"users",user.uid),{
  online:true,
  lastActive: serverTimestamp()
}, { merge:true });
}

window.addEventListener("beforeunload", ()=>{
  updateDoc(doc(db,"users",user.uid),{
    online:false
  });
});

  const userRef = doc(db,"users",user.uid);
let snap;

try {
  snap = await getDoc(userRef);
} catch (err) {
  console.error("Erreur lecture user:", err);
}

if (!snap || !snap.exists()) {
  console.log("User doc n'existe pas, création...");

  try {
    await setDoc(userRef, {
      online: true,
      lastActive: serverTimestamp(),
      username: "Utilisateur"
    }, { merge: true });

    snap = await getDoc(userRef);
  } catch (err) {
    console.error("Erreur création user:", err);
  }
}

if (!snap || !snap.exists()) {
  console.error("Impossible de charger le user");
  return;
}

  const data = snap.data();
  
  if (!data.profileCompleted) {
  window.location.href = "interest.html";
  return;
}
  
  if(data.suspended){

  const now = new Date();
  const until = data.suspendUntil?.toDate?.();

  if(until && until > now){

  alert("Compte suspendu jusqu’au " + until.toLocaleDateString());

  await signOut(auth);
  window.location.href = "login.html";
  return;
}else {
    await updateDoc(userRef,{
      suspended:false,
      suspendUntil:null
    });
  }
}



  currentUser = user;

currentUser.username = data.username || "Utilisateur";
currentUser.avatar = data.avatar || "default-avatar.png";
currentUser.verification = data.verification || null;

  loadFeed();
})

async function registerView(videoId, uid) {
  const videoRef = doc(db, "videos", videoId);
  const viewRef = doc(db, "videos", videoId, "views", uid);

  try {
    await runTransaction(db, async (t) => {
      const viewSnap = await t.get(viewRef);

      if (viewSnap.exists()) return;

      t.set(viewRef, {
        uid,
        createdAt: serverTimestamp()
      });

      t.update(videoRef, {
        viewsCount: increment(1)
      });
    });

  } catch (err) {
    console.error("❌ ERREUR VIEW:", err);
  }
}






/* ================= LOAD FEED ================= */
function escapeHTML(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCaption(text) {
  if (!text) return "";

  text = escapeHTML(text);

  // Hashtags (lettres, chiffres, et underscores)
  text = text.replace(/#(\w+)/g, '<span style="color:#ff0050">#$1</span>');
  
  // Mentions : on autorise les lettres, chiffres, underscores, points et tirets
  // L'expression [\w.-]+ attrape tous ces caractères. 
  // Le suffixe (?!\.) s'assure qu'on ne capture pas un point s'il est à la toute fin (ex: fin de phrase).
  text = text.replace(/@([\w.-]+(?!\.))/g, '<span class="mention" data-user="$1" style="color:#00acee;cursor:pointer;">@$1</span>');

  return text;
}

function buildCaption(text) {
  const cleanText = String(text || "").trim();
  const LIMIT = 80; // Nombre de caractères avant de couper

  if (cleanText.length <= LIMIT) {
    return `<div class="caption">${formatCaption(cleanText)}</div>`;
  }

  const shortText = cleanText.slice(0, LIMIT).trim();

  return `
    <div class="caption caption-collapsed"
      data-full="${escapeHTML(cleanText)}"
      data-short="${escapeHTML(shortText)}">
      <span>${formatCaption(shortText)}...</span>
      <span class="caption-toggle" style="color:#aaa;font-weight:bold;cursor:pointer;margin-left:4px;">Voir plus</span>
    </div>
  `;
}

/* ================= LOAD FEED ================= */
async function loadFeed() {
  console.log("load feed start");
  const feed = document.getElementById("feed");
  
  if (!feed) {
    console.error("❌ DIV #feed introuvable");
    return;
  }

  // 🛑 Sécurité : On stoppe si on a déjà tout chargé
  if (!hasMoreDocs) return;

  if (!lastDoc) {
    feed.innerHTML = "";
  }

  try {
    const q = lastDoc
      ? query(
          collection(db,"videos"),
          where("archived","==",false),
          where("moderationStatus","==","clean"),
          orderBy("score","desc"),
          startAfter(lastDoc),
          limit(5)
        )
      : query(
          collection(db,"videos"),
          where("archived","==",false),
          where("moderationStatus","==","clean"),
          orderBy("score","desc"),
          limit(5)
        );

    const snap = await getDocs(q);
    const docs = snap.docs;

    const params = new URLSearchParams(window.location.search);
    const targetVideoId = params.get("videoId");

    let orderedDocs = [...docs];

    // 🔥 On gère la vidéo partagée
    if (targetVideoId && !lastDoc) {
      const index = orderedDocs.findIndex(d => d.id === targetVideoId);
      
      if (index !== -1) {
        const targetDoc = orderedDocs.splice(index, 1)[0];
        orderedDocs.unshift(targetDoc);
      } else {
        try {
          const targetSnap = await getDoc(doc(db, "videos", targetVideoId));
          if (targetSnap.exists() && 
              targetSnap.data().archived === false && 
              targetSnap.data().moderationStatus === "clean") {
            orderedDocs.unshift(targetSnap);
          }
        } catch (err) {
          console.error("Erreur récupération de la vidéo ciblée :", err);
        }
      }
    }

    // 🛑 GESTION DE LA FIN DES VIDÉOS (Corrigée)
    if (docs.length === 0) {
      hasMoreDocs = false; // On ferme le robinet
      
      if (!lastDoc && orderedDocs.length === 0) {
        feed.innerHTML = `<div style="color:#999;text-align:center;padding:50px">
          Aucune vidéo. <a href="upload.html" style="color:#ff0050">Publiez la première !</a>
        </div>`;
      }
      if (orderedDocs.length === 0) return; 
    }

    // Mise à jour du lastDoc
    lastDoc = docs[docs.length - 1];

    if (!targetVideoId) {
      orderedDocs = orderedDocs.sort(() => Math.random() - 0.5);
    }

    // 🔥 OPTIMISATION VITESSE : On charge tous les utilisateurs manquants EN MÊME TEMPS (Parallèle)
    const missingUserIds = [...new Set(orderedDocs.map(d => d.data().userId).filter(uid => !userCache[uid]))];
    if (missingUserIds.length > 0) {
      await Promise.all(missingUserIds.map(async (uid) => {
        const snapUser = await getDoc(doc(db,"users",uid));
        if (snapUser.exists()) {
          userCache[uid] = snapUser.data();
        } else {
          userCache[uid] = { suspended: false, username: "Utilisateur" };
        }
      }));
    }

    let addedVideosCount = 0; // On compte combien de vidéos passent les filtres

    for (const d of orderedDocs) {
      const v = { id: d.id, ...d.data() };
      
      console.log("📊 VIDÉO CHARGÉE:", v.id, "likesCount:", v.likesCount);
      
      /* ================= SMART SCORE ================= */
      function calculateSmartScore(v){
        const likes = Number(v.likesCount || 0);
        const comments = Number(v.commentsCount || 0);
        const reposts = Number(v.repostsCount || 0);
        const shares = Number(v.sharesCount || 0);
        const views = Math.max(1, Number(v.viewsCount || 0));

        const createdAt = v.createdAt?.toDate ? v.createdAt.toDate() : new Date();
        const ageHours = Math.max(0, (Date.now() - createdAt.getTime()) / 3600000);

        const engagement = (likes * 4) + (comments * 7) + (reposts * 10) + (shares * 8);
        const engagementRate = engagement / views;

        let newVideoBoost = 0;
        if (ageHours < 2) newVideoBoost = 120;
        else if (ageHours < 12) newVideoBoost = 80;
        else if (ageHours < 24) newVideoBoost = 50;
        else if (ageHours < 72) newVideoBoost = 25;

        let lowViewBoost = 0;
        if (views < 20) lowViewBoost = 80;
        else if (views < 100) lowViewBoost = 45;
        else if (views < 500) lowViewBoost = 20;

        const watchScore = Math.min(views * 0.8, 300);
        const decay = Math.max(0.25, 1 - ageHours / 720);

        return Math.round((engagement + engagementRate * 35 + watchScore + newVideoBoost + lowViewBoost) * decay);
      }

      const finalScore = calculateSmartScore(v);

      if (Math.abs(Number(v.score || 0) - finalScore) >= 10) {
        updateDoc(doc(db, "videos", v.id), {
          score: finalScore,
          scoreUpdatedAt: serverTimestamp()
        }).catch(console.error);
      }

      // ================= FILTRE COMPTE SUSPENDU =================
      const ownerData = userCache[v.userId];
      if (ownerData && ownerData.suspended) {
        const now = new Date();
        const until = ownerData.suspendUntil?.toDate?.();
        if (until && until > now) {
          console.log("Vidéo masquée : le créateur est suspendu", v.userId);
          continue; // Saute l'affichage de cette vidéo
        }
      }
      // ==================================================================

      addedVideosCount++; // Cette vidéo va être affichée

      feed.insertAdjacentHTML("beforeend", `
        <div class="video-box" data-id="${v.id}" data-user="${v.userId}" data-score="${finalScore}" style="position: relative; width: 100%; height: 100vh; height: 100dvh; scroll-snap-align: start; flex: 0 0 auto; overflow: hidden; background: #000;">
          <div class="video-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;">
            <video
              data-src="${v.mediaUrls?.[0]}"
              src="${v.mediaUrls?.[0]}"
              playsinline
              webkit-playsinline
              preload="none"
              loop
              crossorigin="anonymous"
              style="width: 100%; height: 100%; object-fit: contain; cursor: pointer; display: block;"
            ></video>
          </div>
          <!-- Les infos et actions sont en position absolue, elles ne dépendent plus de la hauteur de la vidéo -->
          <div class="info" style="position: absolute; z-index: 2; bottom: 105px; left: 15px; width: calc(100% - 70px); text-shadow: 1px 1px 3px rgba(0,0,0,0.8);">
            <div class="username" data-uid="${v.userId}" style="font-weight: bold;">...</div>
            ${buildCaption(v.caption || "")}
          </div>
          <div class="actions" style="position: absolute; z-index: 2; bottom: 200px; right: 5px; display: flex; flex-direction: column; align-items: center; gap: 18px;">
            <div class="avatar-wrapper">
              <div class="avatar">
                 <img class="avatar-img" data-uid="${v.userId}" width="48" height="48" style="border-radius: 50%;">
              </div>
              <div class="follow-plus">+</div>
            </div>
            <div class="action like">
              <svg viewBox="0 0 24 24" width="26" height="26" class="heart-icon" fill="white" style="transition: 0.2s; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span class="like-count" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8); font-size: 13px;">${formatNumber(v.likesCount || 0)}</span>
            </div>
            <div class="action comment-btn" data-role="comment">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white" style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));">
                <path d="M21 6a2 2 0 0 0-2-2H5C3.9 4 3 4.9 3 6v9c0 1.1.9 2 2 2h3v3l4-3h7c1.1 0 2-.9 2-2V6z"/>
              </svg>
              <span class="comment-count" style="text-shadow: 1px 1px 2px rgba(0,0,0,0.8); font-size: 13px;">${formatNumber(v.commentsCount || 0)}</span>
            </div>
            <div class="action gift-btn">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white" style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));">
                <path d="M20 7h-2.18C17.93 6.69 18 6.35 18 6c0-1.66-1.34-3-3-3-1.31 0-2.42.84-2.83 2H12c-.41-1.16-1.52-2-2.83-2-1.66 0-3 1.34-3 3 0 .35.07.69.18 1H4c-1.1 0-2 .9-2 2v2h20V9c0-1.1-.9-2-2-2zM9 6c0-.55.45-1 1-1s1 .45 1 1H9zm5 0c0-.55.45-1 1-1s1 .45 1 1h-2zM2 13v6c0 1.1.9 2 2 2h6v-8H2zm10 8h6c1.1 0 2-.9 2-2v-6h-8v8z"/>
              </svg>
            </div>
            <div class="action favorite">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white" style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
              </svg>
            </div>
            <div class="action share-btn">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white" style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));">
                <path d="M21 12l-7-7v4C7 10 4 15 3 20c2.5-3.5 6-5.1 11-5.1V19l7-7z"/>
              </svg>
            </div>
            <div class="action report-btn">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="white" style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));">
                <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-7.6z"/>
              </svg>
            </div>
          </div>
        </div>
      `);

      if (userCache[v.userId]) {
        updateVideosFromUser(v.userId);
      }
    }
    
    // Garde ta fonction originale à l'intérieur
    function updateVideosFromUser(uid) {
      const videos = document.querySelectorAll(`.video-box[data-user="${uid}"]`);
      videos.forEach(box => {
        const data = userCache[uid];
        if (!data) return;
        const usernameEl = box.querySelector(".username");
        const avatarImg = box.querySelector(".avatar-img");
        
        let badgeHTML = "";
        if (data.verification?.type === "gold" && data.verification?.status === "active") {
          badgeHTML = `<span class="badge badge-gold"><svg viewBox="0 0 24 24" fill="black"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.782 1.402 8.177L12 18.896l-7.336 3.874 1.402-8.177L.132 9.211l8.2-1.193z"/></svg></span>`;
        }
        if (data.verification?.type === "blue" && data.verification?.expiresAt?.toDate() > new Date()) {
          badgeHTML = `<span class="badge badge-blue"><svg viewBox="0 0 24 24" fill="white"><path d="M20.285 6.709l-11.025 11.025-5.545-5.545 1.414-1.414 4.131 4.131 9.611-9.611z"/></svg></span>`;
        }
        if (usernameEl) {
          usernameEl.innerHTML = `<span>${data.username || "Utilisateur"}</span>${badgeHTML}`;
          usernameEl.style.cursor = "pointer";
          usernameEl.onclick = (e) => {
            e.stopPropagation();
            window.location.href = `profil.html?uid=${uid}`;
          };
        }
        if (avatarImg) {
          avatarImg.src = data.avatar || "default-avatar.png";
        }
      });
    }

    initActions();
    initVideoObserver();
    
    if (targetVideoId) {
      setTimeout(() => {
        const targetBox = document.querySelector(`[data-id="${targetVideoId}"]`);
        if (targetBox) {
          targetBox.scrollIntoView({ behavior: "instant" });
        }
      }, 300);
    }
    
    // 🔥 SÉCURITÉ ANTI-BLOCAGE : Si TOUTES les vidéos chargées étaient d'utilisateurs suspendus,
    // on relance pour chercher la page suivante, sinon le scroll bloque !
    if (addedVideosCount === 0 && hasMoreDocs) {
      return loadFeed();
    }
    
  } catch (err) {
    console.error("❌ ERREUR LOAD FEED:", err);
    feed.innerHTML = `
      <div style="color:red;text-align:center;padding:50px">
        ${err.message}
      </div>
    `;
  }
}




/* ================= ACTIONS ================= */
async function initActions() {
  const boxes = document.querySelectorAll(".video-box");

  for (const box of boxes) {
    const videoId = box.dataset.id;
    const userId = box.dataset.user;


    /* ================= FOLLOW ================= */
    const followBtn = box.querySelector(".follow-plus");

    if (userId === currentUser.uid) {
      followBtn.style.display = "none";
    } else {
      const followingRef = doc(db, "users", currentUser.uid, "following", userId);
      const followerRef = doc(db, "users", userId, "followers", currentUser.uid);

      const followSnap = await getDoc(followingRef);
      if (followSnap.exists()) followBtn.classList.add("following");

      followBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  const followingRef = doc(db, "users", currentUser.uid, "following", userId);
  const followerRef = doc(db, "users", userId, "followers", currentUser.uid);
  const meRef = doc(db, "users", currentUser.uid);
  const otherRef = doc(db, "users", userId);

  await runTransaction(db, async (t) => {

    const followSnap = await t.get(followingRef);
    const meSnap = await t.get(meRef);
    const otherSnap = await t.get(otherRef);

    const myFollowing = meSnap.exists() ? (meSnap.data().followingCount || 0) : 0;
    const theirFollowers = otherSnap.exists() ? (otherSnap.data().followersCount || 0) : 0;

    if (!followSnap.exists()) {

      if (myFollowing >= 8000) {
        throw "Limite 8000 suivis atteinte";
      }

      // FOLLOW
      t.set(followingRef, {
        uid: userId,
        createdAt: serverTimestamp()
      });

      t.set(followerRef, {
        uid: currentUser.uid,
        createdAt: serverTimestamp()
      });

      t.update(meRef, { followingCount: myFollowing + 1 });
      t.update(otherRef, { followersCount: theirFollowers + 1 });

      followBtn.classList.add("following");
       
         } else {

      // UNFOLLOW
      t.delete(followingRef);
      t.delete(followerRef);

      t.update(meRef, { followingCount: Math.max(0, myFollowing - 1) });
      t.update(otherRef, { followersCount: Math.max(0, theirFollowers - 1) });

      followBtn.classList.remove("following");
    }
  });
// 🔔 NOTIFICATION FOLLOW
if (userId !== currentUser.uid) {
  await addDoc(collection(db,"notifications"),{
    type:"follow",
    from:currentUser.uid,
    fromUsername:currentUser.username,
    fromAvatar:currentUser.avatar || null,
    to:userId,
    read:false,
    createdAt:serverTimestamp()
  });
  
  // 👇 AJOUT DU PUSH
  await triggerPushNotification(userId, "Nouveau Follower 🎉", `${currentUser.username} a commencé à vous suivre !`, { type: "follow" });
}

});


/* ================= LIKES ================= */
const likeBtn = box.querySelector(".like");
const countEl = likeBtn.querySelector(".like-count");

const videoRef = doc(db, "videos", videoId);
const likeRef = doc(db, "videos", videoId, "likes", currentUser.uid);

// Sync compteur temps réel
onSnapshot(videoRef, snap => {
  if (!snap.exists()) return;
  const data = snap.data();
  countEl.textContent = formatNumber(data.likesCount || 0);
});

// Sync état bouton
onSnapshot(likeRef, snap => {
  if (snap.exists()) {
    likeBtn.classList.add("active");
  } else {
    likeBtn.classList.remove("active");
  }
});

// Toggle like sécurisé avec transaction
likeBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  try {

    await runTransaction(db, async (t) => {

      const likeSnap = await t.get(likeRef);
      const videoSnap = await t.get(videoRef);

      if (!videoSnap.exists()) return;

      const currentLikes = videoSnap.data().likesCount || 0;
      const currentScore = videoSnap.data().score || 0;

      if (likeSnap.exists()) {

        t.delete(likeRef);

        t.update(videoRef, {
          likesCount: Math.max(0, currentLikes - 1),
          score: increment(-4)
        });

      } else {

        t.set(likeRef, {
          uid: currentUser.uid,
          createdAt: serverTimestamp()
        });

        t.update(videoRef, {
          likesCount: currentLikes + 1,
          score: increment(4)
        });
      }

    });
    
// 🔔 NOTIFICATION LIKE
if (userId !== currentUser.uid) {
  await addDoc(collection(db,"notifications"),{
    type:"like",
    from:currentUser.uid,
    fromUsername:currentUser.username,
    fromAvatar:currentUser.avatar || null,
    to:userId,
    videoId:videoId,
    read:false,
    createdAt:serverTimestamp()
  });

  // 👇 AJOUT DU PUSH
  await triggerPushNotification(userId, "Nouveau Like ❤️", `${currentUser.username} a aimé votre vidéo.`, { type: "like", videoId: videoId });
}

  } catch (err) {
    console.error("LIKE ERROR:", err);
  }
});

    /* ================= CADEAUX ================= */
    const giftBtn = box.querySelector(".gift-btn");
    if (giftBtn) {
      giftBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  
        currentVideoId = videoId;
        document.getElementById("giftPanel").classList.add("show");
        document.getElementById("feed").classList.add("disabled");
      });
    }

/* ================= PARTAGE ================= */
const shareBtn = box.querySelector(".share-btn");

if (shareBtn) {

  shareBtn.addEventListener("click", async (e) => {

    e.stopPropagation();

    const url = `${location.origin}/feed.html?videoId=${videoId}`;

    try {

      /* 🔥 menu partage téléphone */
      if (navigator.share) {

        await navigator.share({
          title: "Regarde cette vidéo sur HaytiClips 🔥",
          text: "Découvre cette vidéo sur HaytiClips🔥🇭🇹",
          url: url
        });

      } else {

        /* fallback navigateur */
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
        } else {
          prompt("Copie le lien :", url);
        }

        alert("Lien copié 📋");

      }

      /* 🔥 enregistrer SHARE (pas repost) */
      await updateDoc(doc(db,"videos",videoId),{
        sharesCount: increment(1),
        score: increment(8)
      });

    } catch (err) {

      console.log("Partage annulé:", err);

    }

  });

}
      /* ================= SIGNALEMENT ================= */
const reportBtn = box.querySelector(".report-btn");

if(reportBtn){
  reportBtn.addEventListener("click",(e)=>{
    e.stopPropagation();

    currentVideoId = videoId;

    document.getElementById("reportPanel").classList.add("show");
    document.getElementById("feed").classList.add("disabled");
  });
}
    }
  }
}
/* ================= COMMENTS ================= */
/* ================= COMMENTS ================= */
// 🔥 NOUVEAU : Un tableau global pour traquer TOUS les listeners imbriqués
let commentsUnsubscribe = null;
let activeCommentListeners = []; 

// Fonction pour couper toutes les écoutes Firestore et sauver ta base de données
function closeAllCommentListeners() {
  if (commentsUnsubscribe) {
    commentsUnsubscribe();
    commentsUnsubscribe = null;
  }
  activeCommentListeners.forEach(unsub => unsub());
  activeCommentListeners = [];
}

function openComments(videoId) {
  closeAllCommentListeners(); // On coupe tout avant d'ouvrir un nouveau panneau

  currentVideoId = videoId;

  const sendBtn = document.getElementById("sendComment");
  sendBtn.disabled = false;
  sendBtn.style.opacity = "1";

  document.getElementById("commentsPanel").classList.add("show");
  document.getElementById("feed").classList.add("disabled");

  loadComments(videoId);
  setTimeout(() => document.getElementById("commentText").focus(), 200);
}

// Nettoyage absolu lors de la fermeture du panneau
document.getElementById("closeComments").onclick = () => {
  document.getElementById("commentsPanel").classList.remove("show");
  document.getElementById("feed").classList.remove("disabled");
  currentVideoId = null;
  document.getElementById("sendComment").disabled = true;
  document.getElementById("sendComment").style.opacity = "0.4";
  
  closeAllCommentListeners(); 
};

function loadComments(videoId) {
  const list = document.getElementById("commentsList");
  
  const q = query(collection(db, "videos", videoId, "comments"), orderBy("createdAt", "desc"));
  
  commentsUnsubscribe = onSnapshot(q, snap => {
    // 🔥 CORRECTION VITALE : Nettoyer les écoutes individuelles AVANT de vider la liste HTML
    activeCommentListeners.forEach(unsub => unsub());
    activeCommentListeners = [];

    list.innerHTML = "";

    snap.forEach(d => {
      const c = d.data();
      const isMine = c.uid === currentUser?.uid;
      const date = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString() : "";

      list.insertAdjacentHTML("beforeend", `
        <div class="comment" data-id="${d.id}">
          <img src="${c.avatar || 'https://i.pravatar.cc/100'}">
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;">
              <div>
<div class="comment-username" style="cursor:pointer;" data-uid="${c.uid}">
                   <strong>${c.username}</strong>
                </div>
                <span class="date">${date}</span>
                ${isMine ? `<span class="delete-comment" style="cursor:pointer;color:#ff4d4d;">✕</span>` : ''}
              </div>
            </div>
            <div>${c.text}</div>
            <div class="reply-btn" data-comment="${d.id}" style="font-size:13px;color:black;cursor:pointer;margin-top:4px;">
              Répondre
            </div>
            <div class="replies" id="replies-${d.id}" style="margin-left:35px;margin-top:6px;display:none;"></div>
<div class="toggle-replies" id="toggle-replies-${d.id}" data-comment="${d.id}" style="font-size:12px;color:#888;font-weight:bold;cursor:pointer;margin-top:4px;margin-left:35px;display:none;">
  Voir les réponses
</div>
<div class="comment-like ${c.likes?.[currentUser?.uid] ? 'active' : ''}" data-comment="${d.id}" style="display:flex; align-items:center; gap:4px; cursor:pointer;">
              <svg viewBox="0 0 24 24" width="14" height="14" class="heart-icon" fill="#888" style="transition: 0.2s;">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span>${formatNumber(c.likesCount || 0)}</span>
           </div>
          </div>
        </div>
      `);
      
// --- ÉCOUTE 1 : Données Utilisateur (Nom + Avatar + Badges) ---
      const userRef = doc(db, "users", c.uid);
      const unsubUser = onSnapshot(userRef, userSnap => {
        if (!userSnap.exists()) return;
        const userData = userSnap.data();
        
        let badgeHTML = "";

        if (userData.verification?.type === "gold" && userData.verification?.status === "active") {
          badgeHTML = `<span class="badge badge-gold"><svg viewBox="0 0 24 24" fill="black"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.782 1.402 8.177L12 18.896l-7.336 3.874 1.402-8.177L.132 9.211l8.2-1.193z"/></svg></span>`;
        }

        if (userData.verification?.type === "blue" && userData.verification?.expiresAt?.toDate() > new Date()) {
          badgeHTML = `<span class="badge badge-blue"><svg viewBox="0 0 24 24" fill="white"><path d="M20.285 6.709l-11.025 11.025-5.545-5.545 1.414-1.414 4.131 4.131 9.611-9.611z"/></svg></span>`;
        }

        // 1. Mise à jour du nom et du badge
        const nameContainer = list.querySelector(`.comment[data-id="${d.id}"] .comment-username`);
        if (nameContainer) {
            nameContainer.innerHTML = `<strong>${userData.username}</strong>${badgeHTML}`;
        }
        
        // 2. 🔥 MISE À JOUR DE LA PHOTO DE PROFIL EN TEMPS RÉEL 🔥
        const avatarImg = list.querySelector(`.comment[data-id="${d.id}"] > img`);
        if (avatarImg && userData.avatar) {
          // Si l'utilisateur a un avatar, on l'affiche. Sinon on laisse pravatar.
          avatarImg.src = userData.avatar;
        }
      });
      activeCommentListeners.push(unsubUser);

      // --- ÉCOUTE 2 : Statut du Like ---
      const likeRef = doc(db, "videos", videoId, "comments", d.id, "likes", currentUser.uid);
      const unsubLike = onSnapshot(likeRef, snapLike => {
        const likeBtn = list.querySelector(`.comment-like[data-comment="${d.id}"]`);
        if (!likeBtn) return;

        if (snapLike.exists()) {
          likeBtn.classList.add("active");
        } else {
          likeBtn.classList.remove("active");
        }
      });
      activeCommentListeners.push(unsubLike);
      
      // --- ÉCOUTE 3 : Compteur de Likes (CORRIGÉE) ---
      const unsubCommentCount = onSnapshot(doc(db,"videos",videoId,"comments",d.id), snapComment=>{
        if(!snapComment.exists()) return;
        const data = snapComment.data();
        // 🎯 Modification ici : Ajout de la classe .comment-like pour cibler le bon élément
        const likeBtn = list.querySelector(`.comment-like[data-comment="${d.id}"]`);
        if(!likeBtn) return;
        const spanCount = likeBtn.querySelector("span");
        if(spanCount) {
          spanCount.textContent = formatNumber(data.likesCount || 0);
        }
      });
      activeCommentListeners.push(unsubCommentCount);

// --- ÉCOUTE 4 : Les réponses au commentaire ---
      const repliesRef = collection(db, "videos", videoId, "comments", d.id, "replies");
      const unsubReplies = onSnapshot(repliesRef, snapReplies => {
        const repliesDiv = document.getElementById(`replies-${d.id}`);
        const toggleBtn = document.getElementById(`toggle-replies-${d.id}`);
        if (!repliesDiv || !toggleBtn) return;

        const count = snapReplies.size;

        // Si 0 réponse, on cache le bouton et le conteneur
        if (count === 0) {
          toggleBtn.style.display = "none";
          repliesDiv.style.display = "none";
          return;
        }

        // Sinon on affiche le bouton toggle
        toggleBtn.style.display = "block";
        
        // Mise à jour dynamique du texte
        if (repliesDiv.style.display === "none") {
          toggleBtn.textContent = `—— Voir ${count} réponse${count > 1 ? 's' : ''}`;
        } else {
          toggleBtn.textContent = "—— Masquer les réponses";
        }

        repliesDiv.innerHTML = "";

        snapReplies.forEach(r => {
          const reply = r.data();
          const replyUserRef = doc(db, "users", reply.uid);

          const unsubReplyUser = onSnapshot(replyUserRef, userSnap => {
            if (!userSnap.exists()) return;
            const userData = userSnap.data();
            let badgeHTML = "";

            if (userData.verification?.type === "gold" && userData.verification?.status === "active") {
              badgeHTML = `<span class="badge badge-gold"><svg viewBox="0 0 24 24" fill="black"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.782 1.402 8.177L12 18.896l-7.336 3.874 1.402-8.177L.132 9.211l8.2-1.193z"/></svg></span>`;
            }

            if (userData.verification?.type === "blue" && userData.verification?.expiresAt?.toDate() > new Date()) {
              badgeHTML = `<span class="badge badge-blue"><svg viewBox="0 0 24 24" fill="white"><path d="M20.285 6.709l-11.025 11.025-5.545-5.545 1.414-1.414 4.131 4.131 9.611-9.611z"/></svg></span>`;
            }

            let existingReply = repliesDiv.querySelector(`[data-reply-id="${r.id}"]`);
            const isMyReply = reply.uid === currentUser?.uid;
            
            if (!existingReply) {
              repliesDiv.insertAdjacentHTML("beforeend", `
                <div class="reply-item" data-reply-id="${r.id}" data-parent-id="${d.id}" style="margin-top:4px;">
                  <span class="reply-username" style="cursor:pointer;font-weight:bold;" data-uid="${reply.uid}">
                    ${userData.username} ${badgeHTML}
                  </span> :
                  <span>${reply.text}</span>
                  ${isMyReply ? `<span class="delete-reply" style="cursor:pointer;color:#ff4d4d;font-size:11px;margin-left:8px;">✕</span>` : ''}
                </div>
              `);
            } else {
              existingReply.querySelector('.reply-username').innerHTML = `${userData.username} ${badgeHTML}`;
            }
          });
          
          activeCommentListeners.push(unsubReplyUser);
        });
      });
      
      activeCommentListeners.push(unsubReplies);
    });
  });
}

/* ================= LIKE COMMENT ================= */
document.getElementById("commentsList").addEventListener("click", async (e) => {

  const likeBtn = e.target.closest(".comment-like");
  if (!likeBtn || !currentVideoId || !currentUser) return;

  e.stopPropagation();

  const commentId = likeBtn.dataset.comment;

  const commentRef = doc(db, "videos", currentVideoId, "comments", commentId);
  const likeRef = doc(db, "videos", currentVideoId, "comments", commentId, "likes", currentUser.uid);

  try {

    await runTransaction(db, async (t) => {

      const likeSnap = await t.get(likeRef);
      const commentSnap = await t.get(commentRef);

      if (!commentSnap.exists()) return;

      const currentCount = commentSnap.data().likesCount || 0;

if (likeSnap.exists()) {
        t.delete(likeRef);
        t.update(commentRef, {
          likesCount: Math.max(0, currentCount - 1)
        });
      } else {
        t.set(likeRef, {
          uid: currentUser.uid,
          createdAt: serverTimestamp()
        });
        t.update(commentRef, {
          likesCount: currentCount + 1
        });

        // 🔔 AJOUT : NOTIFICATION LIKE COMMENTAIRE
        const commentOwner = commentSnap.data().uid;
        if (commentOwner && commentOwner !== currentUser.uid) {
          const notifRef = doc(collection(db, "notifications")); // Crée une ref avec ID auto
          t.set(notifRef, {
            type: "comment_like",
            from: currentUser.uid,
            fromUsername: currentUser.username,
            fromAvatar: currentUser.avatar || null,
            to: commentOwner,
            videoId: currentVideoId,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }

    });

  } catch (err) {
    console.error("LIKE ERROR:", err);
  }

});


document.getElementById("commentsList").addEventListener("click", e => {
  const toggleBtn = e.target.closest(".toggle-replies");
  if (!toggleBtn) return;

  const id = toggleBtn.dataset.comment;
  const replies = document.getElementById(`replies-${id}`);
  if (!replies) return;

  const isHidden = replies.style.display === "none";

  if (isHidden) {
    replies.style.display = "block";
    toggleBtn.textContent = "—— Masquer les réponses";
  } else {
    replies.style.display = "none";
    const replyCount = replies.querySelectorAll(".reply-item").length;
    toggleBtn.textContent = `—— Voir ${replyCount} réponse${replyCount > 1 ? 's' : ''}`;
  }
});






// Gestion du bouton "Répondre"
document.getElementById("commentsList").addEventListener("click", (e) => {
  const replyBtn = e.target.closest(".reply-btn");
  if (replyBtn) {
    if (!currentUser || currentUser.isAnonymous) {
      alert("Connecte-toi pour répondre !");
      return;
    }
    
    replyingToCommentId = replyBtn.dataset.comment;
    const input = document.getElementById("commentText");
    input.placeholder = "Répondre au commentaire…";
    input.focus();
    console.log("🎯 MODE RÉPONSE activé pour:", replyingToCommentId);
  }
}); 


/* ================= ENVOYER COMMENTAIRE ================= */
const sendBtn = document.getElementById("sendComment");
const input = document.getElementById("commentText");
sendBtn.onclick = async () => {
  const text = input.value.trim();
  
  if (!currentUser || currentUser.isAnonymous) {
    alert("Connecte-toi pour commenter !");
    return;
  }

  if (!text) {
    alert("Écris quelque chose !");
    return;
  }

  if (!currentVideoId) {
    alert("Erreur: aucune vidéo sélectionnée");
    return;
  }

  // MODE RÉPONSE
  if (replyingToCommentId) {
    console.log("📝 ENVOYER RÉPONSE à:", replyingToCommentId);
    
    try {
      // 1. Ajouter la réponse
      await addDoc(
        collection(db, "videos", currentVideoId, "comments", replyingToCommentId, "replies"),
        {
          uid: currentUser.uid,
          username: currentUser.username || "Utilisateur",
          text,
          createdAt: serverTimestamp()
        }
      );
      
// 2. 🔔 AJOUT : NOTIFICATION DE RÉPONSE
const parentCommentSnap = await getDoc(doc(db, "videos", currentVideoId, "comments", replyingToCommentId));
if (parentCommentSnap.exists()) {
  const parentOwner = parentCommentSnap.data().uid;
  if (parentOwner !== currentUser.uid) {
    await addDoc(collection(db, "notifications"), {
      type: "reply",
      from: currentUser.uid,
      fromUsername: currentUser.username,
      fromAvatar: currentUser.avatar || null,
      to: parentOwner,
      videoId: currentVideoId,
      preview: text.substring(0, 100),
      read: false,
      createdAt: serverTimestamp()
    });

    // 👇 AJOUT DU PUSH
    await triggerPushNotification(parentOwner, "Nouvelle Réponse 💬", `${currentUser.username} a répondu à votre commentaire.`, { type: "reply", videoId: currentVideoId });
  }
}

      console.log("✅ RÉPONSE ENVOYÉE");
      input.value = "";
      replyingToCommentId = null;
      input.placeholder = "Ajouter un commentaire…";
      return; 
      
} catch (err) {
      console.error("❌ ERREUR RÉPONSE:", err);
      alert("Erreur réponse: " + err.message);
      return; // <-- IMPORTANT : Stoppe la fonction ici en cas d'échec pour ne pas créer un vrai commentaire en dessous
     }
  } 
  // MODE COMMENTAIRE NORMAL (seulement si PAS de réponse)
  try {
    console.log("💬 ENVOYER COMMENTAIRE normal");
    
    // Créer le commentaire
    await addDoc(collection(db, "videos", currentVideoId, "comments"), {
      uid: currentUser.uid,
      username: currentUser.username || "Utilisateur",
avatar: currentUser.avatar,
      text,
      likesCount: 0,
      createdAt: serverTimestamp()
    });

    // Mettre à jour le compteur
    const videoRef = doc(db, "videos", currentVideoId);
    const videoSnap = await getDoc(videoRef);
    if (videoSnap.exists()) {
      const currentComments = videoSnap.data().commentsCount || 0;
      await updateDoc(videoRef, {
  commentsCount: increment(1),
  score: increment(7)
});

// 🔔 NOTIFICATION COMMENT
const videoDoc = await getDoc(doc(db,"videos",currentVideoId));
const videoOwner = videoDoc.data().userId;

if (videoOwner !== currentUser.uid) {
  await addDoc(collection(db,"notifications"),{
    type:"comment",
    from:currentUser.uid,
    fromUsername:currentUser.username,
    fromAvatar:currentUser.avatar || null,
    to:videoOwner,
    videoId:currentVideoId,
    preview: text.substring(0,100),
    read:false,
    createdAt:serverTimestamp()
  });

  // 👇 AJOUT DU PUSH
  await triggerPushNotification(videoOwner, "Nouveau Commentaire 💬", `${currentUser.username} a commenté : ${text.substring(0, 30)}...`, { type: "comment", videoId: currentVideoId });
}

    }

    input.value = "";
    console.log("✅ COMMENTAIRE ENVOYÉ");
    
  } catch (err) {
    console.error("❌ ERREUR COMMENTAIRE:", err);
    alert("Erreur: " + err.message);
  }
};

/* ================= NAVIGATION ================= */
document.getElementById("nav-home").onclick = () => window.location.href = "feed.html";
document.getElementById("nav-profile").onclick = () => window.location.href = "profil.html";
document.getElementById("nav-add").onclick = () => window.location.href = "upload.html";
document.getElementById("nav-notif").onclick = () => window.location.href = "notif.html";
document.getElementById("nav-search").onclick = () => window.location.href = "search.html";

/* ================= GESTION CADEAUX ================= */
document.getElementById("closeGifts").onclick = () => {
  document.getElementById("giftPanel").classList.remove("show");
  document.getElementById("feed").classList.remove("disabled");
};

// Initialiser les cadeaux après chargement du DOM
setTimeout(() => {
  // Sélection des cadeaux
  document.querySelectorAll(".gift-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".gift-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      document.getElementById("sendGift").disabled = false;
    });
  });

  // Bouton envoyer cadeau
document.getElementById("sendGift").addEventListener("click", async () => {

const btn = document.getElementById("sendGift");
btn.disabled = true;

try{
  
if(!currentVideoId){
alert("Erreur vidéo");
btn.disabled = false;
return;
}


const selected = document.querySelector(".gift-item.selected");

if(!selected){
alert("Choisis un cadeau");
btn.disabled = false;
return;
}

const amount = Number(selected.dataset.amount);

if(!auth.currentUser || auth.currentUser.isAnonymous){
alert("Connecte-toi pour envoyer un cadeau");
btn.disabled = false;
return;
}


const token = await auth.currentUser.getIdToken(true);

const res = await fetch("https://hayticlip-server.onrender.com/api/sendGift",{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":"Bearer " + token
},
body: JSON.stringify({
videoId: currentVideoId,
amount: amount
})
});

const data = await res.json();

console.log("REPONSE SERVEUR:", data);

if(data.success){

alert("🎁 Cadeau envoyé");

document.getElementById("giftPanel").classList.remove("show");
document.getElementById("feed").classList.remove("disabled");

}else{

alert(data.error);

}

}catch(err){

console.error("erreur cadeau:",err);

alert("Erreur serveur : " + (err.message || JSON.stringify(err)));

}

btn.disabled = false;

       });
     });


/* ================= DÉLÉGATION D'ÉVÉNEMENTS ================= */
// Commentaires
setTimeout(() => {   
  document.getElementById("feed").addEventListener("click", function(e) {
    const btn = e.target.closest('[data-role="comment"]');
    if (btn) {
      const box = btn.closest(".video-box");
      if (box) {
        const videoId = box.dataset.id;
        console.log("📱 OUVRIR COMMENTAIRES:", videoId);
        openComments(videoId);
      }
    }
  });
}, 1500);

// Supprimer commentaire
document.getElementById("commentsList").addEventListener("click", async e => {
  const btn = e.target.closest(".delete-comment");
  if (!btn || !currentVideoId) return;

  const commentEl = btn.closest(".comment");
  const commentId = commentEl.dataset.id;

  try {
    const commentRef = doc(db, "videos", currentVideoId, "comments", commentId);
    await deleteDoc(commentRef);
    
    // Mettre à jour le compteur
    const videoRef = doc(db, "videos", currentVideoId);
    const videoSnap = await getDoc(videoRef);
    if (videoSnap.exists()) {
      const current = videoSnap.data().commentsCount || 0;
      await updateDoc(videoRef, {
  commentsCount: increment(-1),
  score: increment(-7)
});
}

  } catch (err) {
    console.error("❌ ERREUR SUPPRESSION:", err);
  }
});

// ================= CLICS PROFILS ET SUPPRESSION RÉPONSES =================
document.getElementById("commentsList").addEventListener("click", e => {
  
  // 1. Redirection vers le profil si clic sur un nom
  const usernameEl = e.target.closest(".comment-username, .reply-username");
  if (usernameEl && usernameEl.dataset.uid) {
    e.stopPropagation();
    window.location.href = `profil.html?uid=${usernameEl.dataset.uid}`;
    return;
  }
  
  // 2. Supprimer sa propre réponse
  const delReplyBtn = e.target.closest(".delete-reply");
  if (delReplyBtn && currentVideoId) {
    e.stopPropagation();
    const replyItem = delReplyBtn.closest(".reply-item");
    const replyId = replyItem.dataset.replyId;
    const parentId = replyItem.dataset.parentId;
    
    if (replyId && parentId) {
      if (confirm("Supprimer cette réponse ?")) {
        const replyRef = doc(db, "videos", currentVideoId, "comments", parentId, "replies", replyId);
        // Supprime dans Firebase
        deleteDoc(replyRef).catch(err => console.error("Erreur suppression:", err));
        // Retire l'élément visuellement direct pour que l'UI soit instantanée
        replyItem.remove(); 
      }
    }
  }
});

// Réponses
document.getElementById("commentsList").addEventListener("click", e => {
  const replyBtn = e.target.closest(".reply-btn");
  if (replyBtn) {
    if (!currentUser || currentUser.isAnonymous) {
      alert("Connecte-toi pour répondre !");
      return;
    }
    replyingToCommentId = replyBtn.dataset.comment;
    document.getElementById("commentText").placeholder = "Répondre au commentaire…";
    document.getElementById("commentText").focus();
  }
});

document.addEventListener("click", async (e) => {

  const mention = e.target.closest(".mention");
  if (!mention) return;

  e.stopPropagation();

const username = mention.dataset.user.toLowerCase().trim();

  const q = query(
    collection(db,"users"),
    where("usernameLower","==",username),
    limit(1)
  );

  const snap = await getDocs(q);

  snap.forEach(docSnap=>{
    window.location.href = `profil.html?uid=${docSnap.id}`;
  });

});
document.getElementById("closeReport").onclick = ()=>{
  document.getElementById("reportPanel").classList.remove("show");
  document.getElementById("feed").classList.remove("disabled");
  selectedReportReason = null;
};
document.querySelectorAll(".report-item").forEach(item=>{
  item.addEventListener("click",()=>{
    document.querySelectorAll(".report-item")
      .forEach(i=>i.style.background="#222");

    item.style.background="#ff0050";
    selectedReportReason = item.dataset.reason;
  });
});

document.getElementById("sendReport").onclick = async ()=>{

  if(!selectedReportReason){
    alert("Choisissez une raison");
    return;
  }

  if(!currentVideoId) return;

  try{

    const reportRef = doc(
      db,
      "videos",
      currentVideoId,
      "reports",
      currentUser.uid
    );

    const already = await getDoc(reportRef);

    if(already.exists()){
      alert("Vous avez déjà signalé cette vidéo");
      return;
    }

    // 🔥 enregistrer signalement
    await setDoc(reportRef,{
      uid: currentUser.uid,
      reason: selectedReportReason,
      createdAt: serverTimestamp()
    });

    alert("Signalement envoyé");

    document.getElementById("reportPanel").classList.remove("show");
    document.getElementById("feed").classList.remove("disabled");

    selectedReportReason = null;
  }catch(err){
  console.error("SIGNAL ERROR:", err);
  alert(err.message);
}
};
let globalMuted = false; // Mémorise le choix de l'utilisateur pour le son
let videoObserver = null;

function initVideoObserver() {
  if (videoObserver) {
    videoObserver.disconnect();
  }

  videoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const box = entry.target;
      const video = box.querySelector("video");
      if (!video) return;

      if (entry.isIntersecting) {
        // ANTI-LAG : Restaurer la vidéo correctement
        if (!video.getAttribute("src") && video.dataset.src) {
          video.setAttribute("src", video.dataset.src);
          video.load();
        }

        video.muted = globalMuted; 
        
        let playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.log("Autoplay bloqué, passage en sourdine.");
            video.muted = true;
            globalMuted = true;
            video.play().catch(()=>{});
          });
        }

        if (!box.dataset.viewed) {
          box.dataset.viewed = "true";
          registerView(box.dataset.id, currentUser.uid);
        }

      } else {
        if (!video.paused) {
          video.pause();
        }
        video.currentTime = 0; 

        // ANTI-LAG EXTRÊME SÉCURISÉ : Vider la source sans casser l'UI
        if (video.getAttribute("src")) {
          video.removeAttribute("src");
          video.load();
        }
      }
    });
  }, {
    threshold: 0.6
  });

  document.querySelectorAll(".video-box").forEach(box => {
    videoObserver.observe(box);
  });
}

/* ================= REPOST (DELEGATION) ================= */
document.getElementById("feed").addEventListener("click", async (e) => {

  const repostBtn = e.target.closest(".favorite");
  if (!repostBtn) return;

  const box = repostBtn.closest(".video-box");
  if (!box) return;

  const videoId = box.dataset.id;
  const userId = box.dataset.user;

  try {

    const repostRef = doc(db, "users", currentUser.uid, "reposts", videoId);
    const snap = await getDoc(repostRef);

    if (snap.exists()) {

      await deleteDoc(repostRef);

      await updateDoc(doc(db, "videos", videoId), {
        repostsCount: increment(-1),
        score: increment(-10)
      });

      alert("Republication supprimée");

    } else {

      await setDoc(repostRef, {
        videoId: videoId,
        ownerId: userId,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "videos", videoId), {
        repostsCount: increment(1),
        score: increment(10)
      });
      
      // 🔔 NOTIFICATION REPOST
if (userId !== currentUser.uid) {
  await addDoc(collection(db,"notifications"),{
    type:"repost",
    from:currentUser.uid,
    fromUsername:currentUser.username,
    fromAvatar:currentUser.avatar || null,
    to:userId,
    videoId:videoId,
    read:false,
    createdAt:serverTimestamp()
  });
}

      alert("Cette vidéo a été republier");

    }

  } catch (err) {
    console.error("REPOST ERROR:", err);
    alert(err.message);
  }

});

const feedContainer = document.getElementById("feed");

feedContainer.addEventListener("scroll", () => {
  // On bloque si on est déjà en train de charger OU s'il n'y a plus rien à charger
  if (loading || !hasMoreDocs) return;

  // Le threshold est passé de 1000 à 300 pour éviter la boucle folle de requêtes
  if (feedContainer.scrollTop + feedContainer.clientHeight >= feedContainer.scrollHeight - 300) {
    loading = true;
    
    // finally() assure que "loading" redevienne false même en cas d'erreur internet
    loadFeed().finally(() => {
      loading = false;
    });
  }
});

document.addEventListener("click", (e) => {
  const toggle = e.target.closest(".caption-toggle");
  if (!toggle) return;

  e.stopPropagation();

  const caption = toggle.closest(".caption");
  if (!caption) return;

  const full = caption.dataset.full || "";
  const short = caption.dataset.short || "";

  if (caption.classList.contains("caption-expanded")) {
    caption.classList.remove("caption-expanded");
    caption.classList.add("caption-collapsed");

    caption.innerHTML = `
      <span>${formatCaption(short)}...</span>
      <span class="caption-toggle" style="color:#aaa;font-weight:bold;cursor:pointer;margin-left:4px;">Voir plus</span>
    `;
  } else {
    caption.classList.remove("caption-collapsed");
    caption.classList.add("caption-expanded");

    caption.innerHTML = `
      <span>${formatCaption(full)}</span>
      <span class="caption-toggle" style="color:#aaa;font-weight:bold;cursor:pointer;margin-left:4px;">Voir moins</span>
    `;
  }
});

/* ================= GESTION PLAY/PAUSE, SON ET DOUBLE-TAP ================= */
let lastClickTime = 0;

document.getElementById("feed").addEventListener("click", (e) => {
  const videoContainer = e.target.closest(".video-container");
  if (!videoContainer) return;

  const video = videoContainer.querySelector("video");
  if (!video) return;

  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastClickTime;
  
  // DÉTECTION DU DOUBLE CLIC (< 300ms entre deux clics)
  if (tapLength < 300 && tapLength > 0) {
    e.preventDefault();
    const box = videoContainer.closest(".video-box");
    const likeBtn = box.querySelector(".like");
    
    // Déclenche le bouton Like s'il n'est pas déjà actif
    if (likeBtn && !likeBtn.classList.contains("active")) {
      likeBtn.click(); 
    }
  } else {
    // SIMPLE CLIC : Gestion du Play/Pause/Son
    if (video.muted) {
      video.muted = false;
      globalMuted = false;
      video.play();
    } else {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  }
  lastClickTime = currentTime;
});

console.log("feed js loaded");
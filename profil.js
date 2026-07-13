console.log("js charge");
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut, deleteUser, updatePassword } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* FIREBASE */
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
let profileUid = null;
const followBtn = document.getElementById("followBtn");
const ownerActionBtn = document.getElementById("ownerActionBtn");
const viewProductsBtn = document.getElementById("viewProductsBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const settingsOverlay = document.getElementById("settingsOverlay");
const closeSettings = document.getElementById("closeSettings");
const verifyModal = document.getElementById("verifyModal");
const certifiedAccountBtn = document.getElementById("certifiedAccount");
const gestionAccountBtn = document.getElementById("gestionAccount");
const adminPanelBtn = document.getElementById("adminPanelBtn");
const rolesManagerBtn = document.getElementById("rolesManagerBtn");
const merchantRequestBtn = document.getElementById("merchantRequestBtn");
const merchantManagerBtn = document.getElementById("merchantManagerBtn");
const helpCountBtn = document.getElementById("helpCount");
const transfersManagerBtn = document.getElementById("transfersManagerBtn");
if(transfersManagerBtn){
  transfersManagerBtn.style.display = "none";
}
//cacher par default
gestionAccountBtn.style.display = "none";
if(adminPanelBtn){
  adminPanelBtn.style.display = "none";
}
if(rolesManagerBtn){
  rolesManagerBtn.style.display = "none";
}
if(merchantManagerBtn){
  merchantManagerBtn.style.display = "none";
}
const blueOption = document.getElementById("blueOption");
const goldOption = document.getElementById("goldOption");
const walletBox = document.getElementById("walletBox");
const twofaToggle = document.getElementById("twofaToggle");



const saved2FA = localStorage.getItem("2fa_enabled");

if(saved2FA === "1"){
twofaToggle.checked = true;
}

if(saved2FA === "0"){
twofaToggle.checked = false;
}


       

function formatNumber(n){
  if(!n) return "0";

  if(n >= 1000000000){
    return (n/1000000000).toFixed(1).replace(".0","") + "Md";
  }

  if(n >= 1000000){
    return (n/1000000).toFixed(1).replace(".0","") + "M";
  }

  if(n >= 1000){
    return (n/1000).toFixed(1).replace(".0","") + "K";
  }

  return n.toString();
}

if(walletBox){
  walletBox.onclick = () => {
    window.location.href = "wallet.html";
  };
}

settingsBtn.onclick = () => {
  settingsOverlay.style.display = "block";
  settingsPanel.classList.add("show");
};

closeSettings.onclick = closeSettingsPanel;
settingsOverlay.onclick = closeSettingsPanel;

function closeSettingsPanel(){
  settingsPanel.classList.remove("show");
  settingsOverlay.style.display = "none";
}

certifiedAccountBtn.onclick = () => {
  closeSettingsPanel();
  verifyModal.style.display = "flex";
};

window.closeVerifyModal = () => {
  verifyModal.style.display = "none";
};


async function restore2FAState(user){

const userRef = doc(db,"users",user.uid);
const snap = await getDoc(userRef);

if(!snap.exists()) return;

const data = snap.data();

if(twofaToggle){
twofaToggle.checked = data.security?.enabled === true;
}

}

/* AUTH */
onAuthStateChanged(auth, async (currentUser) => {

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  profileUid = params.get("uid") || currentUser.uid;

  if (!profileUid) {
    window.location.href = "login.html";
    return;
  }

  await restore2FAState(currentUser);
    
function setupOwnerActionButton(isMerchantActive){
  if(!ownerActionBtn) return;

  if(isMerchantActive){
    ownerActionBtn.textContent = "Mes produits";
    ownerActionBtn.onclick = () => {
      window.location.href = "merchant-products.html";
    };
  }else{
    ownerActionBtn.textContent = "Partager";
    ownerActionBtn.onclick = async () => {
      const profileUrl = `${window.location.origin}/profil.html?uid=${profileUid}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: "Découvre mon profil sur HaytiClips",
            text: "Découvre mon profil sur HaytiClips🔥🇭🇹",
            url: profileUrl
          });
        } catch (err) {
          console.log("Partage annulé");
        }
      } else {
        await navigator.clipboard.writeText(profileUrl);
        alert("Lien copié !");
      }
    };
  }
}

  const isOwner = profileUid === currentUser.uid;
    const settingsBtn = document.getElementById("settingsBtn");
        if(isOwner){
          settingsBtn.style.display = "block";
        }else{
          settingsBtn.style.display = "none";  
        }
        
        
      const reportFlag = document.getElementById("reportFlag");

if(!isOwner){
   reportFlag.style.display = "flex";
}else{
   reportFlag.style.display = "none";
}
      
if (reportFlag) {

  reportFlag.addEventListener("click", (e) => {
    e.stopPropagation();

    const modal = document.getElementById("profileReportModal");

    if (modal) {
      modal.style.display = "flex";
    } else {
      console.log("modal introuvable");
    }
  });

}
  
  const messageBtn = document.getElementById("messageBtn");

if (!isOwner && messageBtn) {

messageBtn.onclick = async () => {

  if (!currentUser) return;

  const participants = [currentUser.uid, profileUid].sort();
  const convoId = participants.join("_");

  const convoRef = doc(db, "conversations", convoId);

  try {
        const snap = await getDoc(convoRef);
        
        if (!snap.exists()) {
    // 🔥 Toujours créer (merge évite écrasement)
    await setDoc(convoRef, {
      participants: participants,
      createdAt: serverTimestamp()
    });
        }
    window.location.href = `chat.html?conv=${convoId}`;

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};
}
  
  const meSnap = await getDoc(doc(db,"users",currentUser.uid));
const isAdmin = meSnap.exists() && meSnap.data().role === "admin";

document.getElementById("followersCount").onclick = () => {
  openList("followers", profileUid, isOwner, isAdmin);
};

document.getElementById("followingCount").onclick = () => {
  openList("following", profileUid, isOwner, isAdmin);
};

listModal.onclick = () => {
  listModal.style.display="none";
};
  
if (isOwner) {
  const mySnap = await getDoc(doc(db, "users", currentUser.uid));

  if (mySnap.exists()) {
    const myRole = (mySnap.data().role || "").trim();
    console.log("ROLE ACTUEL:", myRole);

if (myRole === "admin") {
  gestionAccountBtn.style.display = "block";
  if(adminPanelBtn) adminPanelBtn.style.display = "block";
  if(rolesManagerBtn) rolesManagerBtn.style.display = "block";
  if(merchantManagerBtn) merchantManagerBtn.style.display = "block";
  if(transfersManagerBtn) transfersManagerBtn.style.display = "block"; // <-- AJOUT
} else if (myRole === "moderator") {
  gestionAccountBtn.style.display = "none";
  if(adminPanelBtn) adminPanelBtn.style.display = "block";
  if(rolesManagerBtn) rolesManagerBtn.style.display = "none";
  if(merchantManagerBtn) merchantManagerBtn.style.display = "none";
  if(transfersManagerBtn) transfersManagerBtn.style.display = "none"; // <-- AJOUT
} else if (myRole === "badge_manager") {
  gestionAccountBtn.style.display = "block";
  if(adminPanelBtn) adminPanelBtn.style.display = "none";
  if(rolesManagerBtn) rolesManagerBtn.style.display = "none";
  if(merchantManagerBtn) merchantManagerBtn.style.display = "none";
  if(transfersManagerBtn) transfersManagerBtn.style.display = "none"; // <-- AJOUT
} else if (myRole === "merchant_manager") {
  gestionAccountBtn.style.display = "none";
  if(adminPanelBtn) adminPanelBtn.style.display = "none";
  if(rolesManagerBtn) rolesManagerBtn.style.display = "none";
  if(merchantManagerBtn) merchantManagerBtn.style.display = "block";
  if(transfersManagerBtn) transfersManagerBtn.style.display = "none"; // <-- AJOUT
} else {
  gestionAccountBtn.style.display = "none";
  if(adminPanelBtn) adminPanelBtn.style.display = "none";
  if(rolesManagerBtn) rolesManagerBtn.style.display = "none";
  if(merchantManagerBtn) merchantManagerBtn.style.display = "none";
  if(transfersManagerBtn) transfersManagerBtn.style.display = "none"; // <-- AJOUT
}
}
}
  const userRef = doc(db, "users", profileUid);

onSnapshot(userRef, async snap => {

  if (!snap.exists()) return;

  const u = snap.data();
  
  // 🔔 BADGE EXPIRÉ

if(
  u.verification?.type === "blue" &&
  u.verification?.status === "active" &&
  u.verification?.expiresAt
){
  const expireDate = u.verification.expiresAt.toDate();

  if(expireDate <= new Date()){
    console.log("Badge blue expiré détecté côté client");
  }
}
  
  if(isOwner){
  twofaToggle.checked = u.security?.enabled === true;
localStorage.setItem("2fa_enabled", u.security?.enabled ? "1" : "0");
}

if(u.suspended){
    const now = new Date();
    const until = u.suspendUntil?.toDate?.();

    if(until && until > now){
      alert("Ce compte est suspendu jusqu’au " + until.toLocaleDateString());

      if (isOwner) {
        // Seul le propriétaire est déconnecté et redirigé
        await signOut(auth);
        window.location.href = "login.html";
      }
      
      // Le visiteur voit juste l'alerte mais reste sur la page
      return; 
      
    } else {
      if (isOwner) {
        // Seul le propriétaire a les droits de retirer sa propre suspension
        await updateDoc(userRef,{
          suspended:false,
          suspendUntil:null
        });
      }
    }
  }
  
    const headerBadge = document.getElementById("headerBadge");
headerBadge.innerHTML = "";

if(u.verification){

// 🔵 BLUE
if(
  u.verification &&
  u.verification.type === "blue" &&
  u.verification.status === "active" &&
  u.verification.expiresAt
){

  const expireDate = u.verification.expiresAt.toDate();

  if(expireDate > new Date()){

    headerBadge.innerHTML = `
      <span class="badge badge-blue">
        <svg viewBox="0 0 24 24" fill="white">
          <path d="M20.285 6.709l-11.025 11.025-5.545-5.545 1.414-1.414 4.131 4.131 9.611-9.611z"/>
        </svg>
      </span>
    `;

      }  
     }
  // 🟡 GOLD
  if(u.verification.type === "gold" && u.verification.status === "active"){
    headerBadge.innerHTML = `
      <span class="badge badge-gold">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="black">
          <path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.782 1.402 8.177L12 18.896l-7.336 3.874 1.402-8.177L.132 9.211l8.2-1.193z"/>
        </svg>
      </span>
    `;
  }
}
    

    document.getElementById("headerUsername").textContent = u.username || "Profil";
document.getElementById("bioText").textContent = u.bio || "";
document.getElementById("avatarImg").src =
  u.avatar || `https://i.pravatar.cc/150?u=${profileUid}`;

const merchantCertifiedBadge = document.getElementById("merchantCertifiedBadge");
const expireDate = u.merchantExpiresAt?.toDate?.() || null;
const merchantExpired = !expireDate || expireDate.getTime() <= Date.now();
const merchantBlocked = u.merchantRenewalBlocked === true;
const isMerchantActive =
  u.merchantEnabled === true &&
  u.merchantStatus === "active" &&
  !merchantBlocked &&
  !merchantExpired;

if(viewProductsBtn){
  if(!isOwner && isMerchantActive){
    viewProductsBtn.style.display = "block";
    viewProductsBtn.textContent = "🛍 Produits";
    viewProductsBtn.onclick = () => {
      window.location.href = `merchant-products.html?uid=${profileUid}`;
    };
  } else {
    viewProductsBtn.style.display = "none";
  }
}

if(merchantCertifiedBadge){
  merchantCertifiedBadge.style.display = isMerchantActive ? "inline-flex" : "none";
}

if(isOwner){
  setupOwnerActionButton(isMerchantActive);
}

    document.getElementById("followersCount").textContent = formatNumber(u.followersCount || 0);
document.getElementById("followingCount").textContent = formatNumber(u.followingCount || 0);
document.getElementById("totalLikes").textContent = formatNumber(u.totalLikes || 0);

    // Bouton "Publier" pour propriétaire
    document.getElementById("uploadBtn").onclick = () => {
      window.location.href = "upload.html";
    };
    
    document.querySelector("#ownerButtons .btn:nth-child(2)").onclick = () => {
  window.location.href = "edit-profile.html";
};


    if (!isOwner) {
      const followingRef = doc(db, "users", currentUser.uid, "following", profileUid);
      
      onSnapshot(followingRef, snap => {
        if (snap.exists()) {
          followBtn.textContent = "✓ Abonné";
        } else {
          followBtn.textContent = "➕ Suivre";
        }
      });

      followBtn.onclick = async () => {
        const followingRef = doc(db, "users", currentUser.uid, "following", profileUid);
        const followerRef = doc(db, "users", profileUid, "followers", currentUser.uid);
        const meRef = doc(db, "users", currentUser.uid);
        const otherRef = doc(db, "users", profileUid);

        await runTransaction(db, async (t) => {
          const followSnap = await t.get(followingRef);
          const meSnap = await t.get(meRef);
          const otherSnap = await t.get(otherRef);

const myFollowing = meSnap.exists() ? (meSnap.data().followingCount || 0) : 0;
const theirFollowers = otherSnap.exists() ? (otherSnap.data().followersCount || 0) : 0;

if (!followSnap.exists() && myFollowing >= 8000){
  throw new Error("Limite de 8000 suivis atteinte");
}

          if (followSnap.exists()) {
            // ❌ UNFOLLOW
            t.delete(followingRef);
            t.delete(followerRef);
            t.update(meRef, { followingCount: Math.max(0, myFollowing - 1) });
            t.update(otherRef, { followersCount: Math.max(0, theirFollowers - 1) });
          } else {
            // ✅ FOLLOW
            t.set(followingRef, { uid: profileUid, createdAt: serverTimestamp() });
            t.set(followerRef, { uid: currentUser.uid, createdAt: serverTimestamp() });
            t.update(meRef, { followingCount: myFollowing + 1 });
            t.update(otherRef, { followersCount: theirFollowers + 1 });
          }
        });
        
        // 🔔 NOTIFICATION FOLLOW (PROFIL)
if (profileUid !== currentUser.uid) {

  await addDoc(collection(db,"notifications"),{
    type:"follow",
    from:currentUser.uid,
    fromUsername: (await getDoc(doc(db,"users",currentUser.uid))).data().username,
    fromAvatar: (await getDoc(doc(db,"users",currentUser.uid))).data().avatar || null,
    to:profileUid,
    read:false,
    createdAt:serverTimestamp()
  });

}
        
      };
    }

    /** VISIBILITÉ **/
    document.getElementById("walletBox").style.display =
  currentUser && isOwner ? "block" : "none";

document.getElementById("ownerButtons").style.display =
  currentUser && isOwner ? "flex" : "none";

document.getElementById("visitorButtons").style.display =
  currentUser && !isOwner ? "flex" : "none";
    if (isOwner) {
      document.getElementById("walletAmount").textContent = u.wallet || 0;
    }
  });

  loadVideos(profileUid);
  loadReposts(profileUid);
});

/* LOAD VIDEOS */
function loadVideos(uid) {

  const grid = document.getElementById("videoGrid");

  const q = query(
  collection(db, "videos"),
  where("userId", "==", uid),
  where("archived", "==", false),
  orderBy("createdAt", "desc")
);

  onSnapshot(q, snap => {

    grid.innerHTML = "";

    if (snap.empty) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;color:#777;text-align:center;padding:40px">
          Aucune publication
        </div>
      `;
      document.getElementById("totalLikes").textContent = "0";
      return;
    }

    let totalLikes = 0;

    snap.forEach(d => {

      const v = d.data();
      totalLikes += (v.likesCount || 0);

     grid.insertAdjacentHTML("beforeend", `
  <div style="position:relative;">

    <video 
      src="${v.mediaUrls?.[0] || ''}" 
      muted 
      playsinline 
      style="
        width:100%;
        aspect-ratio:9/16;
        object-fit:cover;
        display:block;
      "
      onclick="openVideo('${d.id}')">
    </video>

    <!-- OVERLAY VUES -->
    <div style="
      position:absolute;
      bottom:0;
      left:0;
      width:100%;
      padding:6px 8px;
      background:linear-gradient(to top, rgba(0,0,0,0.7), transparent);
      font-size:13px;
      font-weight:500;
      display:flex;
      align-items:center;
      gap:6px;
    ">
      ▶ ${formatNumber(v.viewsCount || 0)}
    </div>

  </div>
`);
    });

    // 🔥 METTRE À JOUR TOTAL EN TEMPS RÉEL
    document.getElementById("totalLikes").textContent =
      formatNumber(totalLikes);

  });
 }
 
 function loadReposts(uid) {

  const grid = document.getElementById("repostGrid");

  const q = query(
    collection(db, "users", uid, "reposts"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, async snap => {

    grid.innerHTML = "";

    if (snap.empty) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;color:#777;text-align:center;padding:40px">
          Aucune republication
        </div>
      `;
      return;
    }

    for (const d of snap.docs) {

      const repost = d.data();
      const videoSnap = await getDoc(doc(db, "videos", repost.videoId));

      if (!videoSnap.exists()) continue;

      const v = videoSnap.data();

      grid.insertAdjacentHTML("beforeend", `
        <div style="position:relative;">

          <video 
            src="${v.mediaUrls?.[0] || ''}" 
            muted 
            playsinline 
            style="
              width:100%;
              aspect-ratio:9/16;
              object-fit:cover;
              display:block;
            "
            onclick="openVideo('${repost.videoId}')">
          </video>

<div style="
            position:absolute;
            bottom:0;
            left:0;
            width:100%;
            padding:6px 8px;
            background:linear-gradient(to top, rgba(0,0,0,0.7), transparent);
            font-size:13px;
            display:flex;
            align-items:center;
            gap:4px;
          ">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="white">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg> 
          </div>

        </div>
      `);
    }

  });
}

let blueProcessing = false;

blueOption.onclick = async () => {
  if (blueProcessing) return;

  blueProcessing = true;
  blueOption.style.opacity = "0.6";
  blueOption.style.pointerEvents = "none";

  try{
    const user = auth.currentUser;
    if(!user) throw new Error("Utilisateur non connecté");

    const token = await user.getIdToken(true);

    const res = await fetch("https://hayticlip-server.onrender.com/api/blue/request-payment",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer " + token
      }
    });

    const result = await res.json();

    if(!res.ok || !result.success){
      throw new Error(result.error || "Erreur serveur");
    }

    alert("Demande envoyée");
    closeVerifyModal();

  }catch(err){
    alert(err.message || err);
  }finally{
    blueProcessing = false;
    blueOption.style.opacity = "1";
    blueOption.style.pointerEvents = "auto";
  }
};

goldOption.onclick = async () => {
   window.location.href = "gold-request.html";
};
  


// LOGOUT
document.getElementById("logoutBtn").onclick = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};

// CHANGER MOT DE PASSE
document.getElementById("changePassword").onclick = () => {
  window.location.href = "change-password.html";
};
// SUPPRIMER COMPTE
const deleteModal = document.getElementById("deleteModal");
const deletePassword = document.getElementById("deletePassword");
const deleteReason = document.getElementById("deleteReason");
const deletePin = document.getElementById("deletePin");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

document.getElementById("deleteAccount").onclick = () => {
  deleteModal.style.display = "flex";
};

window.closeDeleteModal = () => {
  deleteModal.style.display = "none";
};

/* regles et confidential */
helpCountBtn.onclick = () => {
  window.location.href = "rules.html";
}



if(adminPanelBtn){
  adminPanelBtn.onclick = () => {
    window.location.href = "admin.html";
  };
}

if(rolesManagerBtn){
  rolesManagerBtn.onclick = () => {
    window.location.href = "roles.html";
  };
}

if(merchantRequestBtn){
  merchantRequestBtn.onclick = () => {
    window.location.href = "merchant-request.html";
  };
}

if(merchantManagerBtn){
  merchantManagerBtn.onclick = () => {
    window.location.href = "merchant-manager.html";
  };
}

if(transfersManagerBtn){
  transfersManagerBtn.onclick = () => {
    window.location.href = "admin-transfers.html";
  };
}

/* gestion badges admin */
 gestionAccountBtn.onclick = () => {
   window.location.href = "gestion.html";
 };
 
 document.getElementById("manageVideosBtn").onclick = () => {
  window.location.href = "manage-videos.html";
};
 
 const pinModal = document.getElementById("pinModal");
const pinInput = document.getElementById("pinInput");
const savePinBtn = document.getElementById("savePinBtn");



document.addEventListener("DOMContentLoaded", () => {

const twofaToggle = document.getElementById("twofaToggle");

if(!twofaToggle){
  console.log("toggle introuvable");
  return;
}

twofaToggle.addEventListener("change", async () => {

  const user = auth.currentUser;
  if(!user){
    alert("Utilisateur non connecté");
    twofaToggle.checked = !twofaToggle.checked; // Remet le bouton dans son état d'origine
    return;
  }

  const userRef = doc(db,"users",user.uid);
  const snap = await getDoc(userRef);
  const data = snap.data();

  const isEnabled = data.security?.enabled === true;

  // 🔓 ACTIVER
  if(!isEnabled){

    const pin = prompt("Créer PIN 6 chiffres");

    if(!pin || pin.length !== 6 || isNaN(pin)){
      alert("PIN invalide");
      twofaToggle.checked = false; // Annule l'activation visuelle
      return;
    }

    const confirmPin = prompt("Confirmer PIN");

    if(pin !== confirmPin){
      alert("PIN différent");
      twofaToggle.checked = false; // Annule l'activation visuelle
      return;
    }

    try{
      const res = await fetch("https://hayticlip-server.onrender.com/set-pin",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer " + (await auth.currentUser.getIdToken())
        },
        body: JSON.stringify({ pin })
      });
      
      const result = await res.json();
      
      if(result.success) {
        twofaToggle.checked = true;
        alert("2FA activé 🔐");
      } else {
        alert(result.error || "Erreur lors de l'activation");
        twofaToggle.checked = false;
      }
    }catch(e){
      console.error(e);
      alert("Erreur: " + e.message);
      twofaToggle.checked = false;
    }

  }
  // 🔒 DESACTIVER
  else {

    const pin = prompt("Entrer PIN pour désactiver la sécurité");

    if(!pin){
      twofaToggle.checked = true; // Remet le bouton sur "activé" si on annule
      return;
    }

    try {
      // On envoie directement la demande de désactivation AVEC le pin
      const res = await fetch("https://hayticlip-server.onrender.com/remove-pin",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer " + (await auth.currentUser.getIdToken())
        },
        body: JSON.stringify({ pin: pin }) // 👈 LA CORRECTION EST ICI
      });

      const result = await res.json();

      if(!result.success){
        alert(result.error || "PIN incorrect");
        twofaToggle.checked = true; // Remet le bouton sur "activé" car ça a échoué
        return;
      }

      // Si tout est bon, on confirme la désactivation
      twofaToggle.checked = false;
      alert("2FA désactivé 🔓");

    } catch (e) {
      console.error(e);
      alert("Erreur serveur : " + e.message);
      twofaToggle.checked = true; 
    }
  }
});

});

// HASH SIMPLE


// SAUVEGARDE
savePinBtn.onclick = async () => {

  const pin = pinInput.value.trim();

  if(pin.length !== 6 || isNaN(pin)){
    alert("Le code doit être 6 chiffres");
    return;
  }

  await fetch("https://hayticlip-server.onrender.com/set-pin",{
  method:"POST",
  headers:{
    "Content-Type":"application/json",
    "Authorization":"Bearer " + (await auth.currentUser.getIdToken())
  },
  body: JSON.stringify({ pin })
});

  alert("Code activé 🔐");
  pinModal.style.display="none";
};



confirmDeleteBtn.onclick = async () => {

  const password = deletePassword.value.trim();
  const reason = deleteReason.value;
  const pin = deletePin.value.trim();

  if (!reason) {
    alert("Veuillez choisir un motif");
    return;
  }

  if (!password) {
    alert("Mot de passe obligatoire");
    return;
  }

  try {

    const user = auth.currentUser;

    // 🔐 Re-authentification
    const credential = EmailAuthProvider.credential(
      user.email,
      password
    );

    await reauthenticateWithCredential(user, credential);

    // 🔐 Vérifier 2FA si activé
    const userSnap = await getDoc(doc(db,"users",user.uid));
    const userData = userSnap.data();

    if (userData.security?.enabled) {

      if (!pin) {
        alert("Code 2FA obligatoire");
        return;
      }

const res = await fetch("https://hayticlip-server.onrender.com/check-pin",{
  method:"POST",
  headers:{
    "Content-Type":"application/json",
    "Authorization":"Bearer " + (await auth.currentUser.getIdToken())
  },
  body: JSON.stringify({
  pin: pin
})
});

const result = await res.json();

if(!result.success){
  alert("Code 2FA incorrect");
  return;
}
}

    // 📝 Sauvegarder motif suppression
    await addDoc(collection(db,"deletions"),{
      userId:user.uid,
      reason:reason,
      createdAt:serverTimestamp()
    });

    // ❌ Supprimer document Firestore
    await deleteDoc(doc(db,"users",user.uid));

    // ❌ Supprimer compte Auth
    await deleteUser(user);

    alert("Compte supprimé définitivement");

    window.location.href = "login.html";

  } catch(err) {
    console.error(err);
    alert("Erreur : " + err.message);
  }

};

const listModal = document.getElementById("listModal");
const listContainer = document.getElementById("listContainer");
const listTitle = document.getElementById("listTitle");

async function openList(type, profileUid, isOwner, isAdmin){

  listModal.style.display = "block";
  listTitle.textContent = type === "followers" ? "Abonnés" : "Abonnements";
  listContainer.innerHTML = `
    <div style="display:flex; justify-content:center; padding:20px;">
      <div class="loader">Chargement...</div>
    </div>
  `;

  const subCol = type === "followers" ? "followers" : "following";

  let q = query(
    collection(db,"users",profileUid,subCol),
    orderBy("createdAt","desc")
  );

  const snap = await getDocs(q);
  let docs = snap.docs;

  // 🔒 Limite 50 sauf owner ou admin
  if(!isOwner && !isAdmin){
    docs = docs.slice(0,50);
  }

  listContainer.innerHTML = "";

  if(docs.length === 0) {
    listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#888;">Aucun utilisateur trouvé</div>`;
    return;
  }

  for(const d of docs){
    const userId = d.id;
    const userSnap = await getDoc(doc(db,"users",userId));

    if(!userSnap.exists()) continue;

    const data = userSnap.data();
    
    // --- Logique des Badges SVG ---
    let badgeHtml = "";
    if(data.verification && data.verification.status === "active") {
      if(data.verification.type === "blue") {
        // Vérifier expiration Blue
        const expireDate = data.verification.expiresAt?.toDate();
        if(expireDate && expireDate > new Date()) {
          badgeHtml = `
            <span style="display:inline-flex; align-items:center; justify-content:center; background:#0095f6; border-radius:50%; width:16px; height:16px; margin-left:5px;">
              <svg viewBox="0 0 24 24" fill="white" width="10" height="10"><path d="M20.285 6.709l-11.025 11.025-5.545-5.545 1.414-1.414 4.131 4.131 9.611-9.611z"/></svg>
            </span>`;
        }
      } else if(data.verification.type === "gold") {
        badgeHtml = `
          <span style="display:inline-flex; align-items:center; justify-content:center; background:#FFD700; border-radius:50%; width:16px; height:16px; margin-left:5px;">
            <svg viewBox="0 0 24 24" fill="black" width="10" height="10"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.782 1.402 8.177L12 18.896l-7.336 3.874 1.402-8.177L.132 9.211l8.2-1.193z"/></svg>
          </span>`;
      }
    }

    // --- Rendu de la ligne utilisateur ---
    const userRow = document.createElement("div");
    userRow.style = `
      display: flex;
      align-items: center;
      padding: 12px 15px;
      border-bottom: 1px solid #1a1a1a;
      cursor: pointer;
      transition: background 0.2s;
    `;
    userRow.onmouseover = () => userRow.style.background = "#0a0a0a";
    userRow.onmouseout = () => userRow.style.background = "transparent";
    
    // Clic pour aller sur le profil
    userRow.onclick = (e) => {
      e.stopPropagation();
      window.location.href = `profil.html?uid=${userId}`;
    };

    const avatarUrl = data.avatar || `https://i.pravatar.cc/150?u=${userId}`;

    userRow.innerHTML = `
      <img src="${avatarUrl}" style="width:44px; height:44px; border-radius:50%; object-fit:cover; margin-right:12px; border: 1px solid #333;">
      <div style="flex:1; display:flex; align-items:center;">
        <span style="font-weight:600; color:white; font-size:15px;">${data.username}</span>
        ${badgeHtml}
      </div>
      <div style="color:#555; font-size:12px;">Voir →</div>
    `;

    listContainer.appendChild(userRow);
  }

  if(!isOwner && !isAdmin && snap.size > 50){
    listContainer.insertAdjacentHTML('beforeend', `
      <div style="padding:20px; text-align:center; color:#555; font-size:13px;">
        Seuls les 50 premiers sont visibles
      </div>
    `);
  }
}

const tabVideos = document.getElementById("tabVideos");
const tabReposts = document.getElementById("tabReposts");
const tabContent = document.getElementById("tabContent");

tabVideos.onclick = () => {
  tabContent.style.transform = "translateX(0%)";
  tabVideos.style.borderBottom = "2px solid white";
  tabReposts.style.borderBottom = "none";
};

tabReposts.onclick = () => {
  tabContent.style.transform = "translateX(-50%)";
  tabReposts.style.borderBottom = "2px solid white";
  tabVideos.style.borderBottom = "none";
};

window.closeProfileReportModal = () => {
  const modal = document.getElementById("profileReportModal");
  const reason = document.getElementById("profileReportReason");

  if (modal) modal.style.display = "none";
  if (reason) reason.value = "";
};

window.sendProfileReportNow = async () => {

  const confirmProfileReportBtn = document.getElementById("confirmProfileReport");

  try {
    const reason = document.getElementById("profileReportReason").value.trim();

    if (!reason) {
      alert("Choisissez une raison");
      return;
    }

    const reporter = auth.currentUser;

    if (!reporter) {
      alert("Utilisateur non connecté");
      return;
    }

    if (!profileUid) {
      alert("Profil introuvable");
      return;
    }

    const reportRef = doc(
  db,
  "profileReports",
  profileUid + "_" + reporter.uid
);

const reportedSnap = await getDoc(doc(db,"users",profileUid));

    if (!reportedSnap.exists()) {
      alert("Profil introuvable");
      return;
    }

    const reportedData = reportedSnap.data();

    if (confirmProfileReportBtn) {
      confirmProfileReportBtn.disabled = true;
      confirmProfileReportBtn.style.opacity = "0.6";
    }

    await setDoc(reportRef,{
  reportedUser: profileUid,
  reportedUsername: reportedData.username || "",
  reportedBio: reportedData.bio || "",
  reportedAvatar: reportedData.avatar || "",
  followersCount: reportedData.followersCount || 0,
  reason: reason,
  reportedBy: reporter.uid,
  createdAt: serverTimestamp(),
  status:"pending"
}, { merge: true });

    alert("Signalement envoyé");
    window.closeProfileReportModal();

  } catch (err) {
    console.error("ERREUR SIGNALEMENT PROFIL :", err);
    alert("Erreur : " + err.message);
  } finally {
    if (confirmProfileReportBtn) {
      confirmProfileReportBtn.disabled = false;
      confirmProfileReportBtn.style.opacity = "1";
    }
  }
};

window.go = (url) => location.href = url;
window.openVideo = (id) => location.href = `feed.html?videoId=${id}`;

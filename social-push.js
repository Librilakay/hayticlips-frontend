import {
  doc, collection, addDoc, runTransaction, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function requestSocialPush(user, notificationId, proof) {
  try {
    const response = await fetch(
      "https://hayticlip-server.onrender.com/api/send-push",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + await user.getIdToken()
        },
        body: JSON.stringify({ ...proof, notificationId })
      }
    );

    if (!response.ok) console.warn("Push refusé : HTTP", response.status);
  } catch (error) {
    console.warn("Push indisponible :", error.message);
  }
}

export async function publishSocialNotice(db, auth, actor, fields, proof = {}) {
  const user = auth.currentUser;

  if (!user || user.uid !== actor.uid || !fields.to || fields.to === user.uid) {
    return;
  }

  try {
    const notice = await addDoc(collection(db, "notifications"), {
      ...fields,
      from: user.uid,
      fromUsername: actor.username || "Utilisateur",
      fromAvatar: actor.avatar || null,
      read: false,
      createdAt: serverTimestamp()
    });

    void requestSocialPush(user, notice.id, proof);
  } catch (error) {
    console.warn("Notification non enregistrée :", error.message);
  }
}

async function toggleFollow(db, auth, targetUid) {
  const user = auth.currentUser;

  if (!user || user.isAnonymous || user.uid === targetUid) return;

  const me = doc(db, "users", user.uid);
  const target = doc(db, "users", targetUid);
  const following = doc(me, "following", targetUid);
  const follower = doc(target, "followers", user.uid);

  const actor = await runTransaction(db, async tx => {
    const edge = await tx.get(following);
    const mine = await tx.get(me);
    const other = await tx.get(target);

    if (!mine.exists() || !other.exists()) {
      throw new Error("Profil introuvable.");
    }

    const profile = mine.data();
    const myCount = profile.followingCount || 0;
    const theirCount = other.data().followersCount || 0;

    if (edge.exists()) {
      tx.delete(following);
      tx.delete(follower);
      tx.update(me, { followingCount: Math.max(0, myCount - 1) });
      tx.update(target, { followersCount: Math.max(0, theirCount - 1) });
      return null;
    }

    if (myCount >= 8000) throw new Error("Limite de 8 000 abonnements atteinte.");

    tx.set(following, { uid: targetUid, createdAt: serverTimestamp() });
    tx.set(follower, { uid: user.uid, createdAt: serverTimestamp() });
    tx.update(me, { followingCount: myCount + 1 });
    tx.update(target, { followersCount: theirCount + 1 });

    return { uid: user.uid, username: profile.username, avatar: profile.avatar };
  });

  if (actor) {
    await publishSocialNotice(db, auth, actor, { type: "follow", to: targetUid });
  }
}

export function bindFollow(db, auth, button, targetUid, render) {
  const uid = auth.currentUser?.uid;

  if (!uid || uid === targetUid || !button) return;

  const edge = doc(db, "users", uid, "following", targetUid);
  onSnapshot(edge, snap => render(snap.exists()));

  let busy = false;

  button.onclick = async event => {
    event.stopPropagation();
    if (busy || auth.currentUser?.uid !== uid) return;

    busy = true;

    try {
      await toggleFollow(db, auth, targetUid);
    } catch (error) {
      alert(error.message || "Impossible de modifier l’abonnement.");
    } finally {
      busy = false;
    }
  };
}
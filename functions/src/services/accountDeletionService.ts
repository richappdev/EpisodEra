import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

class AccountDeletionService {
  async deleteUserData(userId: string): Promise<void> {
    const firestore = getFirestore();
    await firestore.recursiveDelete(firestore.collection("users").doc(userId));

    try {
      const {deleteUserOwnedOrphansShadow} = await import("../migration/supabaseWriters");
      await deleteUserOwnedOrphansShadow(userId);
    } catch (error) {
      console.error("deleteUserOwnedOrphansShadow failed", userId, error);
    }
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.deleteUserData(userId);
    await getAuth().deleteUser(userId);
  }
}

export const accountDeletionService = new AccountDeletionService();

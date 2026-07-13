import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

class AccountDeletionService {
  async deleteUserData(userId: string): Promise<void> {
    const firestore = getFirestore();
    await firestore.recursiveDelete(firestore.collection("users").doc(userId));
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.deleteUserData(userId);
    await getAuth().deleteUser(userId);
  }
}

export const accountDeletionService = new AccountDeletionService();

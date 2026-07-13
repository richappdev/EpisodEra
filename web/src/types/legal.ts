import {SupportedLanguage} from "./settings";

export const supportEmail = "support@episodera.web.app";

export interface PrivacySection {
  title: string;
  paragraphs: string[];
}

export interface LegalCopy {
  privacy: {
    eyebrow: string;
    title: string;
    updated: string;
    sections: PrivacySection[];
  };
  footer: {
    privacy: string;
    tmdbPrefix: string;
    tmdbLinkLabel: string;
    tmdbSuffix: string;
  };
  settings: {
    privacyTitle: string;
    privacyDescription: string;
    privacyLink: string;
    accountTitle: string;
    accountDescription: string;
    deleteAccount: string;
    deleteDialogTitle: string;
    deleteDialogWarning: string;
    deleteConfirmLabel: string;
    deleteConfirmPlaceholder: string;
    deleteConfirmButton: string;
    deleteCancelButton: string;
    deletingAccount: string;
    signInRequired: string;
  };
  auth: {
    privacyNotice: string;
    privacyLink: string;
  };
}

export const legalCopy: Record<SupportedLanguage, LegalCopy> = {
  "en-US": {
    privacy: {
      eyebrow: "Legal",
      title: "Privacy Policy",
      updated: "Last updated: July 13, 2026",
      sections: [
        {
          title: "Overview",
          paragraphs: [
            "Episodera is a movie and TV tracking web application. This policy explains what personal data we collect, how we use it, and your choices.",
          ],
        },
        {
          title: "Data we collect",
          paragraphs: [
            "Account data: email address, first name, last name, and optional profile fields you provide (display name, bio, country, timezone).",
            "App data you create: watchlist items, episode progress, watched history, and settings such as language and progress preferences.",
            "Usage data: Firebase Analytics and Firebase Performance Monitoring collect page views, navigation events, error reports, and performance metrics. When you are signed in, analytics may be associated with your Firebase user ID.",
            "We do not send your personal data to TMDb. TMDb receives only public metadata requests (search, titles, images) needed to show movie and TV information.",
          ],
        },
        {
          title: "How we use data",
          paragraphs: [
            "We use your data to operate your account, sync watchlist and progress across sessions, display profile statistics, and improve reliability of the service.",
            "Analytics and performance data help us understand how the app is used and diagnose errors.",
          ],
        },
        {
          title: "Third-party services",
          paragraphs: [
            "Firebase (Google): Authentication, Firestore database, Cloud Functions, Analytics, and Performance Monitoring.",
            "TMDb: movie and TV metadata and images. TMDb does not receive your account information. See TMDb attribution in the site footer.",
          ],
        },
        {
          title: "Data retention",
          paragraphs: [
            "While your account is active, we retain your profile, watchlist, progress, history, and settings in Firestore.",
            "When you delete your account, we remove your Firestore user data and Firebase Authentication record promptly.",
            "Firebase Analytics data may persist for a period according to Google's retention settings in our Firebase project, even after account deletion. Signing out clears the analytics user ID for future events on that device.",
          ],
        },
        {
          title: "Your rights",
          paragraphs: [
            "You can review and update profile and settings in the app while signed in.",
            "You can delete your account and associated app data from Settings. Account deletion is permanent.",
            `For privacy questions or support, contact us at ${supportEmail}.`,
          ],
        },
      ],
    },
    footer: {
      privacy: "Privacy",
      tmdbPrefix: "Movie and TV metadata and images from",
      tmdbLinkLabel: "TMDb",
      tmdbSuffix: ". Episodera is not endorsed or certified by TMDb. We send TMDb only public metadata requests, not your account data.",
    },
    settings: {
      privacyTitle: "Privacy & data",
      privacyDescription: "Read what we collect, how analytics work, and how long data is kept.",
      privacyLink: "View privacy policy",
      accountTitle: "Account",
      accountDescription: "Permanently delete your account and all watchlist, progress, history, and profile data.",
      deleteAccount: "Delete account",
      deleteDialogTitle: "Delete your account?",
      deleteDialogWarning:
        "This permanently removes your account, watchlist, progress, history, and settings. This cannot be undone.",
      deleteConfirmLabel: 'Type DELETE to confirm',
      deleteConfirmPlaceholder: "DELETE",
      deleteConfirmButton: "Delete my account",
      deleteCancelButton: "Cancel",
      deletingAccount: "Deleting account...",
      signInRequired: "Sign in to manage account deletion.",
    },
    auth: {
      privacyNotice: "By creating an account, you agree that Episodera stores the data described in our",
      privacyLink: "Privacy Policy",
    },
  },
  "zh-TW": {
    privacy: {
      eyebrow: "法律",
      title: "隱私權政策",
      updated: "最後更新：2026 年 7 月 13 日",
      sections: [
        {
          title: "概述",
          paragraphs: [
            "Episodera 是一款電影與影集追蹤網頁應用程式。本政策說明我們收集哪些個人資料、如何使用，以及您可行使的選擇。",
          ],
        },
        {
          title: "我們收集的資料",
          paragraphs: [
            "帳戶資料：電子郵件、名字、姓氏，以及您選擇提供的個人檔案欄位（顯示名稱、簡介、國家、時區）。",
            "您建立的應用資料：片單、集數進度、觀看紀錄，以及語言與進度偏好等設定。",
            "使用資料：Firebase Analytics 與 Firebase Performance Monitoring 會收集頁面瀏覽、導覽事件、錯誤報告與效能指標。登入時，分析資料可能與您的 Firebase 使用者 ID 關聯。",
            "我們不會將您的個人資料傳送給 TMDb。TMDb 僅收到顯示電影與影集資訊所需的公開中繼資料請求（搜尋、標題、圖片）。",
          ],
        },
        {
          title: "資料用途",
          paragraphs: [
            "我們使用您的資料來運作帳戶、跨工作階段同步片單與進度、顯示個人統計，並改善服務可靠性。",
            "分析與效能資料協助我們了解應用使用情況並診斷錯誤。",
          ],
        },
        {
          title: "第三方服務",
          paragraphs: [
            "Firebase（Google）：驗證、Firestore 資料庫、Cloud Functions、Analytics 與 Performance Monitoring。",
            "TMDb：電影與影集中繼資料及圖片。TMDb 不會收到您的帳戶資訊。請參閱網站頁尾的 TMDb 標示。",
          ],
        },
        {
          title: "資料保留",
          paragraphs: [
            "帳戶有效期間，我們會在 Firestore 保留您的個人檔案、片單、進度、紀錄與設定。",
            "當您刪除帳戶時，我們會儘快移除 Firestore 使用者資料與 Firebase Authentication 記錄。",
            "Firebase Analytics 資料可能依 Firebase 專案中的 Google 保留設定在帳戶刪除後仍保留一段時間。登出後，該裝置上的後續事件將不再關聯分析使用者 ID。",
          ],
        },
        {
          title: "您的權利",
          paragraphs: [
            "登入後可在應用程式中檢視並更新個人檔案與設定。",
            "您可在設定中刪除帳戶及相關應用資料。帳戶刪除無法復原。",
            `如有隱私問題或需要協助，請聯絡 ${supportEmail}。`,
          ],
        },
      ],
    },
    footer: {
      privacy: "隱私權",
      tmdbPrefix: "電影與影集中繼資料及圖片來自",
      tmdbLinkLabel: "TMDb",
      tmdbSuffix: "。Episodera 未獲 TMDb 背書或認證。我們僅向 TMDb 傳送公開中繼資料請求，不會傳送您的帳戶資料。",
    },
    settings: {
      privacyTitle: "隱私與資料",
      privacyDescription: "了解我們收集的資料、分析運作方式，以及資料保留期限。",
      privacyLink: "檢視隱私權政策",
      accountTitle: "帳戶",
      accountDescription: "永久刪除帳戶及所有片單、進度、紀錄與個人檔案資料。",
      deleteAccount: "刪除帳戶",
      deleteDialogTitle: "要刪除帳戶嗎？",
      deleteDialogWarning: "這將永久移除您的帳戶、片單、進度、紀錄與設定，且無法復原。",
      deleteConfirmLabel: "請輸入 DELETE 以確認",
      deleteConfirmPlaceholder: "DELETE",
      deleteConfirmButton: "刪除我的帳戶",
      deleteCancelButton: "取消",
      deletingAccount: "正在刪除帳戶...",
      signInRequired: "請登入以管理帳戶刪除。",
    },
    auth: {
      privacyNotice: "建立帳戶即表示您同意 Episodera 依",
      privacyLink: "隱私權政策",
    },
  },
};

// config.example.js
// এই ফাইলটি একটি টেমপ্লেট — এই ফাইলটি GitHub-এ commit হবে।
// প্রকৃত মানসহ config.js ফাইলটি Render Build Command স্ক্রিপ্ট (build.sh)
// দ্বারা ডিপ্লয়ের সময় স্বয়ংক্রিয়ভাবে তৈরি হবে। config.js কখনো commit হবে না।
//
// লোকাল ডেভেলপমেন্টের জন্য: এই ফাইলটি কপি করে config.js নামে রাখুন
// এবং নিচের placeholder মানগুলো আসল মান দিয়ে প্রতিস্থাপন করুন।

window.__ENV__ = {
  // Firebase Web SDK Config (Firebase Console → Project Settings → Your Apps)
  FIREBASE_API_KEY: "YOUR_FIREBASE_API_KEY_HERE",
  FIREBASE_AUTH_DOMAIN: "your-project-id.firebaseapp.com",
  FIREBASE_PROJECT_ID: "your-project-id",
  FIREBASE_STORAGE_BUCKET: "your-project-id.appspot.com",
  FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  FIREBASE_APP_ID: "1:1234567890:web:abcdef123456",

  // ImgBB API Key (https://api.imgbb.com/)
  IMGBB_API_KEY: "YOUR_IMGBB_API_KEY_HERE",

  // যোগাযোগের জন্য (আন্তর্জাতিক ফরম্যাটে, + ছাড়া। যেমন: 8801XXXXXXXXX)
  WHATSAPP_NUMBER: "8801XXXXXXXXX",

  // Telegram ইউজারনেম (@ ছাড়া)
  TELEGRAM_USERNAME: "your_telegram_username",
};

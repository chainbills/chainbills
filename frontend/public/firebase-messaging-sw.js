importScripts(
  'https://www.gstatic.com/firebasejs/9.6.4/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/9.6.4/firebase-messaging-compat.js',
);

firebase.initializeApp({
  apiKey: true,
  projectId: true,
  messagingSenderId: true,
  appId: true,
});

// TODO: Test if notification works when all the above is absent

export const environment = {
  production: true,
  mode: 'firebase', // 'firebase' or 'selfhosted'
  
  // Firebase configuration (for cloud mode)
  firebase: {
    apiKey: "AIzaSyABlsfWQyAp9v4IpQYS51LKdoG_3r_vC3I",
    authDomain: "money98-b2242.firebaseapp.com",
    databaseURL: "https://money98-b2242-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "money98-b2242",
    storageBucket: "money98-b2242.firebasestorage.app",
    messagingSenderId: "451305489035",
    appId: "1:451305489035:web:a1483a3f794e7914e40a8e",
    measurementId: "G-3SCVB94GB7"
  },
  
  // Self-hosted backend configuration
  // Uses relative path - works with any IP/domain via Ingress
  selfhosted: {
    apiUrl: '/api'
  }
};

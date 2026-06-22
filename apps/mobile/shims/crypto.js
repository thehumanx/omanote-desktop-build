// Installs react-native-quick-crypto as global.crypto so that crypto.subtle
// (PBKDF2, AES-KW, AES-GCM) works on Android/iOS via BoringSSL.
// Import this file before any code that uses the Web Crypto API.
const { install } = require('react-native-quick-crypto');
install();

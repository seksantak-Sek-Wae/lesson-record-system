/**
 * firebase-config.js - ตั้งค่าและเชื่อมต่อ Firebase Realtime Database
 * ระบบบันทึกหลังกิจกรรมการจัดการเรียนรู้ (Lesson Record System)
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAHJzdWz8FjZyMr0D8NrCyuey1ExuUsDU4",
  authDomain: "lesson-record-school.firebaseapp.com",
  databaseURL: "https://lesson-record-school-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lesson-record-school",
  storageBucket: "lesson-record-school.firebasestorage.app",
  messagingSenderId: "29066864378",
  appId: "1:29066864378:web:97996f3ce5f9e6fa738b43",
  measurementId: "G-X13735MKG6"
};

window.FIREBASE_CONFIG = FIREBASE_CONFIG;
window.firebaseDb = null;

// เริ่มต้นการทำงานของ Firebase Realtime Database
try {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
    window.firebaseDb = firebase.database();
    console.log('✅ Firebase Realtime Database เชื่อมต่อสำเร็จ (Singapore - asia-southeast1)');
  }
} catch (err) {
  console.warn('⚠️ เกิดข้อผิดพลาดในการเริ่มต้น Firebase:', err);
}

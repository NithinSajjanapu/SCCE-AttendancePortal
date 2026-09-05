// 1. Import Firebase features using standard web URLs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// 2. Your project's unique configuration
const firebaseConfig = {
  apiKey: "AIzaSyCbfh5-P44TXBqwtIjTvtLfyjvJygnzeZc",
  authDomain: "scceattendance.firebaseapp.com",
  projectId: "scceattendance",
  storageBucket: "scceattendance.firebasestorage.app",
  messagingSenderId: "788847359160",
  appId: "1:788847359160:web:571b6dd9b51507a880b04d",
  measurementId: "G-D7PWJ0G0SW"
};

// 3. Initialize Firebase and start analytics tracking automatically
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

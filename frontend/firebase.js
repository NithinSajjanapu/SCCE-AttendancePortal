<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyCbfh5-P44TXBqwtIjTvtLfyjvJygnzeZc",
    authDomain: "scceattendance.firebaseapp.com",
    projectId: "scceattendance",
    storageBucket: "scceattendance.firebasestorage.app",
    messagingSenderId: "788847359160",
    appId: "1:788847359160:web:571b6dd9b51507a880b04d",
    measurementId: "G-D7PWJ0G0SW"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
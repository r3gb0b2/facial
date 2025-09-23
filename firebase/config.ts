import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// =================================================================================================
// == ATENÇÃO: AÇÃO NECESSÁRIA! ====================================================================
// 1. Crie um projeto no Firebase: https://console.firebase.google.com/
// 2. Vá para as "Configurações do Projeto" > "Geral" e encontre "Seus apps".
// 3. Registre um novo app da Web para obter seu objeto `firebaseConfig`.
// 4. COLE o seu objeto `firebaseConfig` aqui, substituindo o objeto de exemplo abaixo.
// 5. Vá para "Build > Firestore Database", crie um banco de dados e inicie em "modo de teste".
// =================================================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDlaBCtgD74608i4JdOMQYJ0433V-c0bjI",
  authDomain: "facial-244d7.firebaseapp.com",
  projectId: "facial-244d7",
  storageBucket: "facial-244d7.appspot.com",
  messagingSenderId: "979969706148",
  appId: "1:979969706148:web:14fbcd486911fe40dc3e31"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app);

export { db, storage };
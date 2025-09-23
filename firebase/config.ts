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
// == SOLUÇÃO DE PROBLEMAS (TROUBLESHOOTING) =======================================================
// Se você ver o erro "Could not reach Cloud Firestore backend" ou "permission-denied":
// 1. VERIFIQUE SE AS CREDENCIAIS ABAIXO ESTÃO CORRETAS: Elas devem ser EXATAMENTE as que o
//    Firebase forneceu para o seu projeto. Copie e cole novamente para ter certeza.
// 2. VERIFIQUE SE O BANCO DE DADOS FOI CRIADO: No painel do Firebase, vá em "Firestore Database"
//    e certifique-se de que ele foi criado e está em "modo de teste". Se as regras de segurança
//    estiverem muito restritivas, a conexão falhará.
// 3. VERIFIQUE A INTERNET: O erro também pode ser causado por uma conexão de internet instável
//    ou um firewall bloqueando o acesso ao Google Cloud.
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
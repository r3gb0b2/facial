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
//
// 1. VERIFIQUE AS CREDENCIAIS ABAIXO: Elas devem ser EXATAMENTE as que o Firebase forneceu.
//    Um único caractere errado causará falha. Copie e cole novamente para ter certeza.
//
// 2. AJUSTE AS REGRAS DE SEGURANÇA (CAUSA MAIS COMUM): Por padrão, o Firebase bloqueia
//    todo o acesso. Você PRECISA liberar o acesso no painel do Firebase.
//
//    COMO LIBERAR O ACESSO PARA DESENVOLVIMENTO:
//    - Firestore: Vá para Build > Firestore Database > Aba "Regras". Cole o seguinte código e publique:
//      rules_version = '2';
//      service cloud.firestore {
//        match /databases/{database}/documents {
//          match /{document=**} {
//            // PERIGO: Permite acesso total por 30 dias. Altere a data!
//            allow read, write: if request.time < timestamp.date(2025, 10, 23);
//          }
//        }
//      }
//
//    - Storage: Vá para Build > Storage > Aba "Regras". Cole o seguinte código e publique:
//      rules_version = '2';
//      service firebase.storage {
//        match /b/{bucket}/o {
//          match /{allPaths=**} {
//            // Permite que qualquer pessoa leia e escreva os arquivos.
//            allow read, write: if true;
//          }
//        }
//      }
//    - ATENÇÃO: Lembre-se de alterar a data na regra do Firestore e clicar em "Publicar".
//
// 3. VERIFIQUE SE O BANCO DE DADOS FOI CRIADO: No painel "Firestore Database", certifique-se
//    de que ele foi criado (geralmente em "modo de teste" para começar).
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
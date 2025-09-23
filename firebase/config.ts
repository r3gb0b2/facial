import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// =================================================================================================
// ❌❌❌ ATENÇÃO: AÇÃO OBRIGATÓRIA! ❌❌❌
// SE VOCÊ COPIOU E COLOU ESTE ARQUIVO SEM ALTERAR AS CREDENCIAIS ABAIXO, ELE NÃO VAI FUNCIONAR.
// A APLICAÇÃO PRECISA DAS CHAVES DO *SEU* PROJETO FIREBASE PARA SE CONECTAR.
// =================================================================================================
//
// == CHECKLIST DE SOLUÇÃO DE PROBLEMAS ============================================================
// Se os dados não estão sendo salvos, verifique estes 3 pontos no seu painel do Firebase:
//
// ✅ 1. AS CREDENCIAIS ESTÃO CORRETAS?
//    - Vá para as "Configurações do Projeto" (⚙️) > "Geral".
//    - Em "Seus apps", encontre seu app da Web.
//    - Copie o objeto `firebaseConfig` e COLE-O AQUI, substituindo o objeto de exemplo.
//
// ✅ 2. O BANCO DE DADOS FOI CRIADO?
//    - Vá para "Build > Firestore Database".
//    - Se você vir um botão "Criar banco de dados", clique nele e inicie em "modo de teste".
//
// ✅ 3. AS REGRAS DE SEGURANÇA FORAM ATUALIZADAS?
//    - Por padrão, ninguém pode ler ou escrever. Você PRECISA liberar o acesso.
//
//    - No Firestore (Build > Firestore Database > Aba "Regras"):
//      Cole isto e clique em "Publicar". **LEMBRE-SE DE ATUALIZAR A DATA!**
//      rules_version = '2';
//      service cloud.firestore {
//        match /databases/{database}/documents {
//          match /{document=**} {
//            // Permite acesso por 30 dias. Altere a data para o futuro!
//            allow read, write: if request.time < timestamp.date(2025, 11, 23);
//          }
//        }
//      }
//
//    - No Storage (Build > Storage > Aba "Regras"):
//      Cole isto e clique em "Publicar".
//      rules_version = '2';
//      service firebase.storage {
//        match /b/{bucket}/o {
//          match /{allPaths=**} {
//            allow read, write: if true;
//          }
//        }
//      }
// =================================================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDlaBCtgD74608i4JdOMQYJ0433V-c0bjI",
  authDomain: "facial-244d7.firebaseapp.com",
  projectId: "facial-244d7",
  // CORREÇÃO CRÍTICA: O formato correto do domínio é .appspot.com
  storageBucket: "facial-244d7.appspot.com",
  messagingSenderId: "979969706148",
  appId: "1:979969706148:web:14fbcd486911fe40dc3e31"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("Firebase Initialized Successfully with projectId:", app.options.projectId);


// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Initialize Firebase Storage
const storage = getStorage(app);

export { db, storage };
// FIX: Switched to Firebase v8 compat libraries to resolve "initializeApp" import error,
// which typically occurs when using v9 syntax with an older Firebase SDK version.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";

// =================================================================================================
// ❌❌❌ ATENÇÃO: AÇÃO OBRIGATÓRIA! ❌❌❌
// SE VOCÊ COPIOU E COLOU ESTE ARQUIVO SEM ALTERAR AS CREDENCIAIS ABAIXO, ELE NÃO VAI FUNCIONAR.
// A APLICAÇÃO PRECISA DAS CHAVES DO *SEU* PROJETO FIREBASE PARA SE CONECTAR.
// =================================================================================================
// FIX: Added a type annotation for the config object to inform TypeScript of its shape, resolving an error on 'firebaseConfig.apiKey'.
const firebaseConfig: {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
} = {
  // COLE SUAS CREDENCIAIS AQUI
  // Exemplo:
  // apiKey: "AIza....",
  // authDomain: "seu-projeto.firebaseapp.com",
  // projectId: "seu-projeto",
  // storageBucket: "seu-projeto.appspot.com",
  // messagingSenderId: "...",
  // appId: "1:..."
};
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
// =================================================================================================

// Initialize Firebase
if (!firebase.apps.length) {
  // A simple check to avoid initializing the app multiple times.
  // We also check if the config object has an apiKey before trying to initialize.
  if (firebaseConfig.apiKey) {
    firebase.initializeApp(firebaseConfig);
  } else {
    console.error("Firebase config is missing. Please add your credentials to firebase/config.ts");
  }
}

const db = firebase.firestore();
const storage = firebase.storage();
const FieldValue = firebase.firestore.FieldValue;
const Timestamp = firebase.firestore.Timestamp;

// FIX: Explicitly export the Timestamp instance type for use in type annotations elsewhere.
export type FirebaseTimestamp = firebase.firestore.Timestamp;

export { db, storage, FieldValue, Timestamp };

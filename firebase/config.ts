// FIX: Switched to Firebase v8 compat libraries to resolve "initializeApp" import error,
// which typically occurs when using v9 syntax with an older Firebase SDK version.
// FIX: Changed to default import for firebase compat app, which is the correct way to import the main firebase object.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";

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
  databaseURL: "https://facial-244d7-default-rtdb.firebaseio.com",
  projectId: "facial-244d7",
  storageBucket: "facial-244d7.firebasestorage.app",
  messagingSenderId: "979969706148",
  appId: "1:979969706148:web:14fbcd486911fe40dc3e31"
};

// Verifica se as credenciais de exemplo ainda estão em uso e alerta o desenvolvedor.
if (firebaseConfig.apiKey === "AIzaSyDlaBCtgD74608i4JdOMQYJ0433V-c0bjI") {
    const errorMessage = "CONFIGURAÇÃO NECESSÁRIA: As credenciais do Firebase em 'firebase/config.ts' são valores de exemplo e precisam ser substituídas pelas chaves do SEU projeto. A aplicação não funcionará corretamente até que você as atualize seguindo o checklist no arquivo.";
    console.error("======================================================================================");
    console.error("🔥🔥🔥 ERRO DE CONFIGURAÇÃO DO FIREBASE 🔥🔥🔥");
    console.error(errorMessage);
    console.error("======================================================================================");
}


// Initialize Firebase, but only if it hasn't been initialized already.
// This is a safeguard against issues caused by module re-evaluation.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase Initialized with projectId:", firebaseConfig.projectId);
}


// Initialize Cloud Firestore and get a reference to the service
const db = firebase.firestore();

// Initialize Firebase Storage
const storage = firebase.storage();

// Explicitly export the necessary members from the single, initialized firebase instance.
// This is the most robust way to prevent instance mismatch errors.
const FieldValue = firebase.firestore.FieldValue;
// FIX: Changed from a `type` alias to a `const` to make the Timestamp class value available for static methods like `.now()`.
// The class can also be used as a type.
const Timestamp = firebase.firestore.Timestamp;

// FIX: Removed duplicate `export type { Timestamp }` which caused a "Duplicate identifier" error.
// The Timestamp class is exported below and can be used as both a value and a type.
export { db, storage, FieldValue, Timestamp };
export type { Timestamp } from 'firebase/compat/app';
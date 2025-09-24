// FIX: Provided full content for `suppliers.ts`.

// Use environment variables in a real production app!
export const ADMIN_PASSWORD = "admin";

// This is a static list for demo purposes.
// In a real application, this would come from the 'suppliers' subcollection in Firestore.
// The `sectors` array should contain sector IDs from your Firestore database.
export const SUPPLIERS = [
  {
    name: "Fornecedor Geral",
    password: "123",
    sectors: ["pista", "vip", "camarote", "staff"], // Example IDs
  },
  {
    name: "Fornecedor Pista",
    password: "pista",
    sectors: ["pista"],
  },
  {
    name: "Fornecedor VIP",
    password: "vip",
    sectors: ["vip", "camarote"],
  },
];

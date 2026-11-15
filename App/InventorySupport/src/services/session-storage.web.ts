const TOKEN_KEY = 'inventory-support.auth-token';

// shortcut: web dùng localStorage nên token có thể bị đọc bởi script cùng origin; dùng cookie HttpOnly khi triển khai web cần bảo vệ cao hơn.
export const tokenStorage = {
  get: async () => localStorage.getItem(TOKEN_KEY),
  set: async (token: string) => { localStorage.setItem(TOKEN_KEY, token); },
  clear: async () => { localStorage.removeItem(TOKEN_KEY); },
};

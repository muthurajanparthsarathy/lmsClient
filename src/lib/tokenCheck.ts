interface DecodedToken {
  exp: number;
  iat: number;
  id: string;
  role?: string;
  roleValue?: string;
  institution?: string;
  [key: string]: any;
}

export const decodeJWT = (token: string): DecodedToken | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;
  
  const currentTime = Date.now() / 1000;
  return decoded.exp < currentTime;
};

export const getRoleFromToken = (token: string): string | null => {
  const decoded = decodeJWT(token);
  if (!decoded) return null;

  // Check multiple possible locations for role
  return decoded.roleValue || decoded.role || decoded.userRole || null;
};

export const validateTokenRole = (token: string, requiredRole: string): boolean => {
  if (isTokenExpired(token)) return false;
  
  const tokenRole = getRoleFromToken(token);
  return tokenRole?.toLowerCase() === requiredRole.toLowerCase();
};
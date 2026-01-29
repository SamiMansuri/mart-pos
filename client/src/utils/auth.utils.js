import { jwtDecode } from 'jwt-decode';

/**
 * Utility to decode and extract user information from JWT token
 */
export const getUserInfo = () => {
    let token = localStorage.getItem('token');

    // Defensive check for missing or stringified 'null'/'undefined'
    if (!token || token === 'null' || token === 'undefined') {
        return null;
    }

    try {
        const decoded = jwtDecode(token);

        // Return structured user info
        return {
            id: decoded.user_id || decoded.id,
            userName: decoded.user_name || decoded.sub,
            role: decoded.role ? decoded.role.toLowerCase() : null,
            exp: decoded.exp
        };
    } catch (error) {
        console.error('Failed to decode token:', error);
        return null;
    }
};

/**
 * Check if current user has admin privileges
 */
export const isAdmin = () => {
    const user = getUserInfo();
    return user && user.role === 'admin';
};

/**
 * Check if current user is a cashier
 */
export const isCashier = () => {
    const user = getUserInfo();
    return user && user.role === 'cashier';
};

/**
 * Check if the token is expired
 */
export const isTokenExpired = () => {
    const user = getUserInfo();
    if (!user || !user.exp) return true;

    // exp is in seconds, Date.now() is in milliseconds
    return user.exp * 1000 < Date.now();
};

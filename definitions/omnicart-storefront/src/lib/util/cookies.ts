import Cookies from 'js-cookie'

// Cookie names for various data
const CART_COOKIE = '_medusa_cart_id'
const JWT_COOKIE = '_medusa_jwt'
const CACHE_ID_COOKIE = '_medusa_cache_id'

export const getCartId = (): string | undefined => {
  return Cookies.get(CART_COOKIE)
}

export const setCartId = (cartId: string): void => {
  Cookies.set(CART_COOKIE, cartId, {
    expires: 30, // 30 days
    sameSite: 'lax',
    path: '/'
  })
}

export const removeCartId = (): void => {
  Cookies.remove(CART_COOKIE, {
    sameSite: 'lax',
    path: '/'
  })
}

export const getAuthToken = (): string | undefined => {
  return Cookies.get(JWT_COOKIE)
}

export const setAuthToken = (token: string): void => {
  Cookies.set(JWT_COOKIE, token, {
    expires: 30, // 30 days
    sameSite: 'lax',
    path: '/'
  })
}

export const removeAuthToken = (): void => {
  Cookies.remove(JWT_COOKIE, {
    sameSite: 'lax',
    path: '/'
  })
}

export const getCacheId = (): string | undefined => {
  return Cookies.get(CACHE_ID_COOKIE)
}

// Function to generate headers with authentication token for API requests
export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken()
  
  if (token) {
    return {
      'Authorization': `Bearer ${token}`
    }
  }
  
  return {}
}

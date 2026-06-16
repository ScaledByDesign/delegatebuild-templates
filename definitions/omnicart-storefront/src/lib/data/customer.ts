import { medusaClient } from "../medusa-client"
import medusaError from "../util/medusa-error"
import { getAuthHeaders, removeAuthToken, setAuthToken, getCartId, removeCartId } from "../util/cookies"

// Define types for API responses
type AuthResponse = {
  customer: any;
  access_token: string;
}

type CustomerResponse = {
  customer: any;
}

/**
 * Login a customer with email and password
 */
export const loginCustomer = async (email: string, password: string) => {
  if (!email || !password) {
    throw new Error("Email and password are required")
  }

  try {
    // Use proper Medusa API auth method
    const response = await medusaClient.post<AuthResponse>("/auth/customer/emailpass", { email, password })
    const token = response.access_token

    // Store the JWT token in cookies
    if (token) {
      setAuthToken(token as string)
    }

    // Transfer any existing cart to the authenticated user
    await transferCart()

    // Get customer profile
    const customer = await getCustomer()
    return customer
  } catch (error) {
    throw medusaError(error)
  }
}

/**
 * Register a new customer
 */
export const registerCustomer = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string
) => {
  if (!email || !password) {
    throw new Error("Email and password are required")
  }

  try {
    // Step 1: Register authentication
    const response = await medusaClient.post<AuthResponse>("/auth/customer/emailpass/register", {
      email,
      password,
    })
    const token = response.access_token

    // Step 2: Set auth token
    if (token) {
      setAuthToken(token as string)
    }

    // Step 3: Create customer profile
    const headers = getAuthHeaders()
    const customerForm = {
      email,
      first_name: firstName,
      last_name: lastName,
    }

    const { customer: createdCustomer } = await medusaClient.post<CustomerResponse>(
      "/store/customers",
      customerForm,
      { headers }
    )

    // Step 4: Login again to get fresh token (Medusa pattern)
    const loginResponse = await medusaClient.post<AuthResponse>("/auth/customer/emailpass", {
      email,
      password,
    })
    const loginToken = loginResponse.access_token

    if (loginToken) {
      setAuthToken(loginToken as string)
    }

    // Step 5: Transfer any existing cart
    await transferCart()

    return createdCustomer
  } catch (error) {
    throw medusaError(error)
  }
}

/**
 * Get the current customer profile
 */
export const getCustomer = async () => {
  try {
    const headers = {
      ...getAuthHeaders(),
    }

    // If no auth token exists, return null
    if (Object.keys(headers).length === 0) {
      return null
    }

    const response = await medusaClient.get<CustomerResponse>(
      "/store/customers/me",
      {
        headers,
      }
    )

    return response.customer
  } catch (error) {
    // If unauthorized, clear the token
    if (error instanceof Response && error.status === 401) {
      removeAuthToken()
      return null
    }
    
    return null
  }
}

/**
 * Logout the current customer
 */
export const logoutCustomer = async () => {
  try {
    // Use proper Medusa API logout
    await medusaClient.post("/auth/session", { action: "logout" })

    // Remove auth token
    removeAuthToken()

    // Clear cart ID to start fresh
    removeCartId()

    return true
  } catch (error) {
    // Even if the API call fails, we still want to remove tokens
    removeAuthToken()
    removeCartId()
    return true
  }
}

/**
 * Update customer information
 */
export const updateCustomer = async (data: Record<string, any>) => {
  try {
    const headers = {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    } as Record<string, string>

    // If no auth token exists, return null
    if (!headers["Authorization"]) {
      return null
    }

    const response = await medusaClient.fetch(
      "/store/customers/me",
      {
        method: "POST",
        body: JSON.stringify(data),
        headers,
      }
    ) as CustomerResponse

    return response.customer
  } catch (error) {
    throw medusaError(error)
  }
}

/**
 * Request a password reset
 */
export const requestPasswordReset = async (email: string) => {
  if (!email) {
    throw new Error("Email is required")
  }

  try {
    await medusaClient.fetch(
      "/store/customers/password-token",
      {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    )

    return true
  } catch (error) {
    throw medusaError(error)
  }
}

/**
 * Reset password with token
 */
export const resetPassword = async (
  email: string,
  password: string,
  token: string
) => {
  if (!email || !password || !token) {
    throw new Error("Email, password and token are required")
  }

  try {
    await medusaClient.fetch(
      "/store/customers/password-reset",
      {
        method: "POST",
        body: JSON.stringify({ email, password, token }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    )

    return true
  } catch (error) {
    throw medusaError(error)
  }
}

/**
 * Transfer cart to authenticated customer
 */
export const transferCart = async () => {
  const cartId = getCartId()

  if (!cartId) {
    return
  }

  try {
    const headers = getAuthHeaders()

    // Only transfer if we have auth headers
    if (Object.keys(headers).length === 0) {
      return
    }

    await medusaClient.post(`/store/carts/${cartId}/transfer`, {}, { headers })
  } catch (error) {
    console.error("Error transferring cart:", error)
    // Don't throw error as this is not critical for auth flow
  }
}

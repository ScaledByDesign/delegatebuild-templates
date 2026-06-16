/**
 * A utility function to handle errors from Medusa API calls
 */
export default function medusaError(error: unknown): never {
  if (error instanceof Response) {
    throw new Error(`Medusa error: ${error.statusText}`)
  }

  if (error instanceof Error) {
    throw error
  }

  throw new Error(`Medusa error: ${JSON.stringify(error)}`)
}

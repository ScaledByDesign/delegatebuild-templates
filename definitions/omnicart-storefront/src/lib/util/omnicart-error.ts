/**
 * A utility function to handle errors from OmniCart API calls
 */
export default function omnicartError(error: unknown): never {
  if (error instanceof Response) {
    throw new Error(`OmniCart error: ${error.statusText}`)
  }

  if (error instanceof Error) {
    throw error
  }

  throw new Error(`OmniCart error: ${JSON.stringify(error)}`)
}

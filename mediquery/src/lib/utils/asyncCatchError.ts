export type ErrorHandler = (error: unknown) => void

export async function asyncCatchError<T>(operation: () => Promise<T>, onError?: ErrorHandler): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    console.error('[asyncCatchError]', error)

    if (onError) {
      onError(error)
    }

    return null
  }
}

export const catchAsync = asyncCatchError

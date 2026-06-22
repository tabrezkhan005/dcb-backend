export function success<T>(data: T, message?: string) {
  return message !== undefined
    ? { success: true as const, data, message }
    : { success: true as const, data };
}

export function error(message: string, code?: string) {
  return code !== undefined
    ? { success: false as const, error: message, code }
    : { success: false as const, error: message };
}

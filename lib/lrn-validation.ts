export const LRN_LENGTH = 12

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export const normalizeLrn = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

export const validateLrn = (
  value: unknown
): { isValid: boolean; lrn: string; errorMessage?: string } => {
  const lrn = normalizeLrn(value)

  if (!lrn) {
    return {
      isValid: false,
      lrn,
      errorMessage: 'Please enter an LRN.'
    }
  }

  if (!/^\d+$/.test(lrn)) {
    return {
      isValid: false,
      lrn,
      errorMessage: 'LRN must contain only numbers.'
    }
  }

  if (lrn.length !== LRN_LENGTH) {
    return {
      isValid: false,
      lrn,
      errorMessage: 'LRN must be exactly 12 digits.'
    }
  }

  return {
    isValid: true,
    lrn
  }
}
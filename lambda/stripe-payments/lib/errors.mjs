export class PaginationTokenError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'PaginationTokenError';
    this.code = code;
  }
}

export class TokenExpiredError extends PaginationTokenError {
  constructor(message = 'Pagination token has expired') {
    super(message, 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
  }
}

export class TokenTamperedError extends PaginationTokenError {
  constructor(message = 'Pagination token signature is invalid') {
    super(message, 'TOKEN_TAMPERED');
    this.name = 'TokenTamperedError';
  }
}

export class TokenMalformedError extends PaginationTokenError {
  constructor(message = 'Pagination token is malformed') {
    super(message, 'TOKEN_MALFORMED');
    this.name = 'TokenMalformedError';
  }
}

export class CustomerMismatchError extends PaginationTokenError {
  constructor(message = 'Pagination token does not belong to this customer') {
    super(message, 'CUSTOMER_MISMATCH');
    this.name = 'CustomerMismatchError';
  }
}

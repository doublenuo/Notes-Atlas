export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'invalid_request', message);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, retryAfter: number) {
    super(429, 'rate_limited', message, retryAfter);
  }
}

export class InvalidCodeError extends AppError {
  constructor(message = '验证码错误或已过期') {
    super(400, 'invalid_code', message);
  }
}

export class MailDeliveryError extends AppError {
  constructor() {
    super(502, 'mail_unavailable', '验证码邮件发送失败，请稍后再试');
  }
}

export class GithubError extends AppError {
  constructor(message: string, code = 'github_error') {
    super(502, code, message);
  }
}

export class GithubLinkError extends AppError {
  constructor(message = '该邮箱已绑定其他 GitHub 账号') {
    super(409, 'github_email_conflict', message);
  }
}

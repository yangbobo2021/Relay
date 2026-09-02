export const RELAY_EMAIL_API_VERSION = 1;
export const RELAY_GMAIL_PUSH_PATH = "/api/relay/email/gmail/push";

export class EmailConnectorError extends Error {
  constructor(errorClass, message, statusCode = 500) {
    super(message);
    this.name = "EmailConnectorError";
    this.errorClass = errorClass;
    this.statusCode = statusCode;
  }
}

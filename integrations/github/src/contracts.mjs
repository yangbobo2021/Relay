export const RELAY_GITHUB_API_VERSION = 1;
export const RELAY_GITHUB_WEBHOOK_PATH = "/api/relay/github/webhook";
export const GITHUB_TRANSITION_EVENT = "github.pull_request.transition";

export class GitHubConnectorError extends Error {
  constructor(errorClass, message, statusCode = 500) {
    super(message);
    this.name = "GitHubConnectorError";
    this.errorClass = errorClass;
    this.statusCode = statusCode;
  }
}

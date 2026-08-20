// An error that carries an HTTP status code for the error handler to use.
// `extra` fields are merged into the JSON error body as first-class fields
// (e.g. the quiz gate's lockReason).
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = "HttpError";
  }
}

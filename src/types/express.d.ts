declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
      requestId?: string;
    }
  }
}

export {};

/**
 * Minimal typings for `imapflow`.
 *
 * The package ships `lib/types.d.ts` but does not point at it from
 * package.json, so TypeScript cannot find it. Rather than hard-code a path
 * into a versioned node_modules directory, this declares the small surface we
 * actually use — which also documents it.
 */
declare module 'imapflow' {
  export interface ListResponse {
    path: string;
    name?: string;
    specialUse?: string;
    flags?: Set<string>;
  }

  export interface SearchQuery {
    from?: string;
    since?: Date;
    before?: Date;
    subject?: string;
  }

  export interface FetchQuery {
    source?: boolean;
    uid?: boolean;
    envelope?: boolean;
  }

  export interface FetchedMessage {
    uid: number;
    source?: Buffer;
  }

  export interface MailboxLock {
    path: string;
    release: () => void;
  }

  export interface ImapFlowOptions {
    host: string;
    port: number;
    secure?: boolean;
    auth: { user: string; pass?: string; accessToken?: string };
    logger?: false | Record<string, unknown>;
  }

  export class ImapFlow {
    constructor(options: ImapFlowOptions);
    connect(): Promise<void>;
    logout(): Promise<void>;
    list(): Promise<ListResponse[]>;
    getMailboxLock(path: string): Promise<MailboxLock>;
    search(query: SearchQuery, options?: { uid?: boolean }): Promise<number[] | false>;
    fetchOne(
      range: string,
      query: FetchQuery,
      options?: { uid?: boolean },
    ): Promise<FetchedMessage | false>;
  }
}

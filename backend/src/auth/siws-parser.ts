// ──────────────────────────────────────────────────────────────────────────────
// Chainbills Backend — Sign-In With Solana (SIWS) message parser
//
// Parses the SIWS text format into a typed object. The format mirrors EIP-4361
// (SIWE) but uses Solana account addresses (base58) and has a text-based rather
// than EIP-712-based structure.
//
// Required fields: domain, address, uri, version, chainId, nonce, issuedAt.
// Optional fields: statement, expirationTime, notBefore, requestId, resources.
//
// The parser does NOT verify the signature — that is SiwsVerifier's job.
// ──────────────────────────────────────────────────────────────────────────────

/** All fields extracted from a SIWS message. */
export interface SiwsMessage {
  /** Domain making the sign-in request (host of the service). */
  domain: string;
  /** Solana account address (base58). */
  address: string;
  /** Optional human-readable statement about the sign-in. */
  statement?: string;
  /** URI of the resource the signing is for. */
  uri: string;
  /** SIWS version (should be "1"). */
  version: string;
  /** Chain ID for the Solana network (e.g. "mainnet", "devnet"). */
  chainId: string;
  /** Unique nonce to prevent replay attacks. */
  nonce: string;
  /** ISO 8601 datetime when the message was issued. */
  issuedAt: string;
  /** ISO 8601 datetime after which the message is no longer valid. */
  expirationTime?: string;
  /** ISO 8601 datetime before which the message is not valid. */
  notBefore?: string;
  /** Identifier for the request (application-specific). */
  requestId?: string;
  /** List of URIs the signing is requesting access to. */
  resources?: string[];
}

/** Thrown when a required SIWS field is missing or the message is malformed. */
export class SiwsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiwsParseError';
  }
}

/**
 * Parses the SIWS text-format message into a {@link SiwsMessage}.
 *
 * The expected format is:
 * ```
 * {domain} wants you to sign in with your Solana account:
 * {address}
 *
 * {statement}
 *
 * URI: {uri}
 * Version: {version}
 * Chain ID: {chainId}
 * Nonce: {nonce}
 * Issued At: {issuedAt}
 * [Expiration Time: {expirationTime}]
 * [Not Before: {notBefore}]
 * [Request ID: {requestId}]
 * [Resources:
 * - {resource}
 * ...]
 * ```
 *
 * The statement is optional; when present it is separated from the address and
 * URI block by blank lines. All tagged fields (URI:, Version:, ...) must appear
 * in order, though optional ones may be absent.
 */
export function parseSiwsMessage(raw: string): SiwsMessage {
  // Normalise line endings.
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');

  if (lines.length < 2) {
    throw new SiwsParseError('message too short');
  }

  // Line 0: "{domain} wants you to sign in with your Solana account:"
  const headerSuffix = ' wants you to sign in with your Solana account:';
  const header = lines[0];
  if (!header.endsWith(headerSuffix)) {
    throw new SiwsParseError('missing or malformed header line');
  }
  const domain = header.slice(0, header.length - headerSuffix.length).trim();
  if (!domain) throw new SiwsParseError('domain is empty');

  // Line 1: address (must not be blank)
  const address = lines[1].trim();
  if (!address) throw new SiwsParseError('address line is missing or empty');

  // Lines after the address: optional blank line + optional statement + blank line + tagged fields.
  // Find the first tagged field (URI:) to know where the body ends.
  let cursor = 2;

  // Skip exactly one blank line after the address (required by the format).
  if (cursor < lines.length && lines[cursor].trim() === '') {
    cursor++;
  }

  // Collect optional statement lines — everything up to the blank line
  // that precedes the tagged fields block.
  let statement: string | undefined;
  const statementLines: string[] = [];
  while (cursor < lines.length && !lines[cursor].startsWith('URI:')) {
    const line = lines[cursor];
    // A blank line followed by the URI block ends the statement.
    if (line.trim() === '') {
      cursor++;
      break;
    }
    statementLines.push(line);
    cursor++;
  }
  if (statementLines.length > 0) {
    statement = statementLines.join('\n').trim();
    if (!statement) statement = undefined;
  }

  // Tagged fields: collect remaining non-resource lines.
  const taggedLines: string[] = [];
  let inResources = false;
  const resources: string[] = [];

  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line.startsWith('Resources:')) {
      inResources = true;
      cursor++;
      continue;
    }
    if (inResources) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        resources.push(trimmed.slice(2).trim());
      } else if (trimmed !== '') {
        // Treat non-resource non-blank lines as end of resources section.
        inResources = false;
        taggedLines.push(line);
      }
    } else {
      taggedLines.push(line);
    }
    cursor++;
  }

  /**
   * Extracts the value of a required tagged field (e.g. "URI: https://...").
   * Throws {@link SiwsParseError} if the field is missing.
   */
  function requireField(prefix: string): string {
    const found = taggedLines.find((l) => l.startsWith(prefix + ': '));
    if (!found) throw new SiwsParseError(`missing required field: ${prefix}`);
    return found.slice(prefix.length + 2).trim();
  }

  /**
   * Extracts the value of an optional tagged field. Returns undefined if absent.
   */
  function optionalField(prefix: string): string | undefined {
    const found = taggedLines.find((l) => l.startsWith(prefix + ': '));
    if (!found) return undefined;
    return found.slice(prefix.length + 2).trim() || undefined;
  }

  const uri = requireField('URI');
  const version = requireField('Version');
  const chainId = requireField('Chain ID');
  const nonce = requireField('Nonce');
  const issuedAt = requireField('Issued At');
  const expirationTime = optionalField('Expiration Time');
  const notBefore = optionalField('Not Before');
  const requestId = optionalField('Request ID');

  return {
    domain,
    address,
    ...(statement !== undefined && { statement }),
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    ...(expirationTime !== undefined && { expirationTime }),
    ...(notBefore !== undefined && { notBefore }),
    ...(requestId !== undefined && { requestId }),
    ...(resources.length > 0 && { resources }),
  };
}

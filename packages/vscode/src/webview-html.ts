export interface WebviewHtmlOptions {
  /** `webview.cspSource`: the origin the webview loads its own files from. */
  readonly cspSource: string
  readonly scriptUri: string
  readonly styleUri: string
  /** A fresh random value per page; the one script that may run carries it. */
  readonly nonce: string
}

/**
 * The page of the Tree's webview: the built bundle's script and style and one
 * mount point. The policy lets nothing load except those files, the fonts they
 * name and the one nonce'd script, so no inline script can run.
 */
export const webviewHtml = ({
  cspSource,
  scriptUri,
  styleUri,
  nonce,
}: WebviewHtmlOptions): string =>
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${cspSource}; font-src ${cspSource}; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Hero Synergy</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>
`

/** A nonce for one page: 128 random bits as hex. */
export const makeNonce = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

import type { GitHubCollectFailed } from '@hero-synergy/core'

import type { Notice } from './protocol.ts'

/**
 * What a failed GitHub collect says, in the words the Tree shows: the reason,
 * and the fix when there is one the user can act on.
 */
export const describeCollectFailure = (error: GitHubCollectFailed): Notice => {
  switch (error.reason) {
    case 'gh-missing':
      return {
        message: 'The GitHub CLI (gh) is not installed.',
        fix: 'Install it from https://cli.github.com, then run `gh auth login`.',
      }
    case 'not-logged-in':
      return { message: 'gh is not logged in to GitHub.', fix: 'Run `gh auth login`.' }
    case 'rate-limited':
      return {
        message: 'The GitHub rate limit is spent.',
        fix:
          error.resetAt === undefined
            ? 'Refresh once it has come back.'
            : `It comes back at ${error.resetAt}.`,
      }
    case 'secondary-limit':
      return {
        message: 'GitHub asked the Cockpit to slow down.',
        fix:
          error.retryAfter === undefined
            ? 'Refresh in a minute.'
            : `Refresh in ${error.retryAfter} seconds.`,
      }
    case 'network':
      return {
        message: 'GitHub could not be reached.',
        fix: 'Check the network connection or the proxy, then refresh.',
      }
    case 'timeout':
      return { message: 'GitHub did not answer in time.', fix: 'Refresh to try again.' }
    case 'server':
      return { message: error.message, fix: 'Refresh to try again.' }
    case 'no-remote':
      return {
        message: 'No git remote names a GitHub repository.',
        fix: 'Add a GitHub remote, or switch the tracker doc to Local Markdown.',
      }
    case 'graphql-error':
    case 'unexpected-response':
    case 'request-failed':
      return { message: error.message, fix: null }
  }
}

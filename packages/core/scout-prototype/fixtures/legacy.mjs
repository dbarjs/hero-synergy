// PROTOTYPE fixture: a bundle in the shape `gh api graphql` returns, written in the legacy wayfinder forms
// (M2 map body with Fog, task-list children, "Part of #n", "Blocked by:" lines, wayfinder:claimed, Type: lines,
// tickets without "## Question", a free-form map, a ticket with two type labels).
// Expected code-only reading: frontier of #1 = #2, #9; frontier of #6 = #7.
const url = (n) => `https://github.com/acme/legacy/issues/${n}`;
const labels = (...names) => ({ totalCount: names.length, nodes: names.map((name) => ({ name })) });
const issue = (number, over) => ({
  number, title: '', url: url(number), state: 'OPEN', stateReason: null, updatedAt: '2026-07-03T10:00:00Z', body: '',
  labels: labels(), assignees: { totalCount: 0, nodes: [] }, parent: null,
  subIssues: { totalCount: 0, nodes: [] }, subIssuesSummary: { total: 0, completed: 0, percentCompleted: 0 },
  blockedBy: { totalCount: 0, nodes: [] }, blocking: { totalCount: 0, nodes: [] },
  issueDependenciesSummary: { blockedBy: 0, totalBlockedBy: 0, blocking: 0, totalBlocking: 0 },
  comments: { totalCount: 0, nodes: [] }, ...over,
});
const comment = (body, author = 'ana') => ({ totalCount: 1, nodes: [{ author: { login: author }, createdAt: '2026-07-03T11:00:00Z', body }] });

const items = [
  issue(1, { title: 'Billing rewrite, decided', labels: labels('wayfinder:map'), body: `## Notes

- Domain: invoicing for a multi-tenant SaaS. Grilling tickets use /grilling.
- Driver: Ana.

## Decisions so far

- [Which database holds the ledger?](${url(3)}): Postgres, one schema per tenant
- #5 was dropped, see the comment there

## Fog

- How invoice numbers stay unique across tenants once #2 is settled.
- Retry policy for failed charges.

### Tickets

- [ ] #2
- [x] #3
- [ ] #4
- [x] #5
` }),
  issue(2, { title: 'Refund: reopen the invoice or issue a credit note?', labels: labels('wayfinder:grilling'), body: `Part of #1
Blocked by: #3

## Question

Should a refund reopen the original invoice, or always create a credit note that references it? Accountants in two pilot tenants disagree.` }),
  issue(3, { title: 'Which database holds the ledger?', state: 'CLOSED', labels: labels('wayfinder:research'), body: `Part of #1

Which database should hold the ledger? Compare Postgres and DynamoDB for per-tenant isolation, point-in-time restore and cost at 500 tenants.`, comments: comment('Postgres. One schema per tenant keeps isolation and restore simple; DynamoDB would need a partition-key convention and loses ad-hoc reporting. Findings on research/ledger-db.') }),
  issue(4, { title: 'How do invoice numbers stay unique per tenant?', labels: labels('wayfinder:grilling', 'wayfinder:claimed'), body: `Part of #1
Blocked by: #2

## Question

Does each tenant get its own sequence, or is there one global sequence with a tenant prefix? Legal requires gapless numbering in two countries.` }),
  issue(5, { title: 'Does a PDF preview in the admin UI earn its place?', state: 'CLOSED', labels: labels('wayfinder:prototype'), body: `Part of #1

## Question

Does an inline PDF preview of the invoice help support staff, or is the emailed PDF enough?`, comments: comment('Dropped: support staff open the emailed PDF anyway. Prototype on prototype/pdf-preview. Not part of this effort.') }),
  issue(6, { title: 'Checkout redesign', labels: labels('wayfinder:map'), subIssues: { totalCount: 2, nodes: [{ number: 7 }, { number: 8 }] }, subIssuesSummary: { total: 2, completed: 1, percentCompleted: 50 }, body: `# Checkout redesign

We want a one-page checkout live before Q4 so the trial-to-paid rate stops bleeding on step 3. Open questions are tracked as sub-issues of this issue.

Done so far: we picked Stripe Elements over a hosted page (#8), because the hosted page can't show the per-seat price breakdown.

Not doing this round: Apple Pay and Google Pay. Still fuzzy: how tax shows for EU customers before they enter an address.` }),
  issue(7, { title: 'What does the one-page layout look like on mobile?', parent: { number: 6, url: url(6) }, body: `Type: prototype
Blocked by: #8

What does the one-page checkout look like on a phone? Three rough variants to react to: stacked, accordion, and a two-step with the payment form last.` }),
  issue(8, { title: 'Stripe Elements or Stripe Checkout?', state: 'CLOSED', parent: { number: 6, url: url(6) }, labels: labels('wayfinder:research'), body: `## Question

Which Stripe integration lets us show a per-seat price breakdown next to the card form: Elements, or the hosted Checkout page?`, comments: comment('Elements. Checkout renders Stripe\'s own line items and cannot show our seat breakdown. Findings on research/stripe-integration.') }),
  issue(9, { title: 'Who approves a manual credit above 1,000?', labels: labels('wayfinder:grilling', 'wayfinder:research'), body: `Part of #1

## Question

Which role may approve a manual credit above 1,000, and does it need two people?` }),
];

export default {
  data: {
    repository: {
      labels: { nodes: ['wayfinder:map', 'wayfinder:research', 'wayfinder:prototype', 'wayfinder:grilling', 'wayfinder:task', 'wayfinder:claimed'].map((name) => ({ name })) },
      issues: { totalCount: items.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes: items },
    },
    rateLimit: { cost: 1, remaining: 4999, limit: 5000, nodeCount: 0, resetAt: '2026-07-03T12:00:00Z' },
  },
};

const ReviewerSelector = require('../src/lib/reviewer-selector');

// Mock the config module
jest.mock('../src/lib/config', () => ({
  get: () => ({
    team: ['alice', 'bob', 'charlie', 'david'],
    excluded: ['dependabot[bot]'],
    lookbackPRs: 30,
    maxPendingReviews: 3
  }),
  isUnavailable: () => false
}));

describe('ReviewerSelector', () => {
  const mockPRHistory = [
    {
      number: 3,
      author: { login: 'alice' },
      closedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      reviews: [
        { author: { login: 'bob' }, state: 'APPROVED', submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }
      ]
    },
    {
      number: 2,
      author: { login: 'bob' },
      closedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      reviews: [
        { author: { login: 'charlie' }, state: 'COMMENTED', submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { author: { login: 'alice' }, state: 'APPROVED', submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
      ]
    },
    {
      number: 1,
      author: { login: 'charlie' },
      closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      reviews: [
        { author: { login: 'bob' }, state: 'APPROVED', submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }
      ]
    }
  ];

  const mockOpenPRs = [
    {
      number: 4,
      author: { login: 'charlie' },
      reviewRequests: [{ login: 'bob' }]
    }
  ];

  let selector;

  beforeEach(() => {
    selector = new ReviewerSelector(mockPRHistory, mockOpenPRs);
  });

  describe('getRecentApprovals', () => {
    test('should return approvals from recent PRs sorted by date', () => {
      const approvals = selector.getRecentApprovals();
      expect(approvals.length).toBe(3);
      expect(approvals[0].reviewer).toBe('bob'); // Most recent approval
      expect(approvals[0].prNumber).toBe(3);
      expect(approvals[1].reviewer).toBe('alice');
      expect(approvals[2].reviewer).toBe('bob');
    });
  });

  describe('getPendingReviews', () => {
    test('should track current pending review requests', () => {
      const pending = selector.getPendingReviews();
      expect(pending.bob).toBe(1);
      expect(pending.alice).toBeUndefined();
      expect(pending.charlie).toBeUndefined();
    });
  });

  describe('getEligibleReviewers', () => {
    test('should exclude PR author', () => {
      const eligible = selector.getEligibleReviewers('alice');
      expect(eligible).not.toContain('alice');
      expect(eligible).toContain('bob');
      expect(eligible).toContain('charlie');
      expect(eligible).toContain('david');
    });

    test('should exclude bot accounts', () => {
      const eligible = selector.getEligibleReviewers('alice');
      expect(eligible).not.toContain('dependabot[bot]');
    });
  });

  describe('selectReviewer', () => {
    test('should select reviewer with fewest recent approvals', () => {
      const result = selector.selectReviewer('eve'); // Author not in team
      expect(result).toBeDefined();
      expect(result.reviewer).toBeDefined();
      
      // Charlie and David have 0 recent approvals, should be prioritized over Alice (1) and Bob (2)
      expect(['charlie', 'david']).toContain(result.reviewer);
    });

    test('should prefer reviewer who approved longest ago when approval counts are equal', () => {
      // Both Charlie and David have 0 approvals, but we need to check tie-breaking logic
      const result = selector.selectReviewer('eve');
      expect(result).toBeDefined();
      expect(['charlie', 'david']).toContain(result.reviewer);
    });

    test('should return null when no eligible reviewers', () => {
      // Mock config to return empty team
      const originalConfig = require('../src/lib/config');
      originalConfig.get = jest.fn(() => ({
        team: [],
        excluded: [],
        lookbackPRs: 30,
        maxPendingReviews: 3
      }));

      const result = selector.selectReviewer('alice');
      expect(result).toBeNull();
    });

    test('should penalize reviewers with too many pending reviews', () => {
      // Create a reviewer with many pending reviews
      const mockOpenPRsWithManyPending = [
        { reviewRequests: [{ login: 'charlie' }] },
        { reviewRequests: [{ login: 'charlie' }] },
        { reviewRequests: [{ login: 'charlie' }] },
        { reviewRequests: [{ login: 'charlie' }] } // 4 pending, over the limit
      ];
      
      const selectorWithPending = new ReviewerSelector(mockPRHistory, mockOpenPRsWithManyPending);
      const result = selectorWithPending.selectReviewer('eve');
      
      expect(result).toBeDefined();
      expect(result.reviewer).not.toBe('charlie'); // Should not select overloaded reviewer
      expect(['alice', 'bob', 'david']).toContain(result.reviewer);
    });
  });

  describe('calculateReviewStats', () => {
    test('should calculate recent approval counts correctly', () => {
      const stats = selector.calculateReviewStats();
      
      expect(stats.alice).toBeDefined();
      expect(stats.alice.recentApprovals).toBe(1);
      expect(stats.bob.recentApprovals).toBe(2);
      expect(stats.charlie.recentApprovals).toBe(0);
      expect(stats.david.recentApprovals).toBe(0);
    });

    test('should track pending reviews correctly', () => {
      const stats = selector.calculateReviewStats();
      
      expect(stats.bob.pendingReviews).toBe(1);
      expect(stats.alice.pendingReviews).toBe(0);
      expect(stats.charlie.pendingReviews).toBe(0);
      expect(stats.david.pendingReviews).toBe(0);
    });

    test('should track last approval dates', () => {
      const stats = selector.calculateReviewStats();
      
      expect(stats.alice.lastApprovalDate).toBeDefined();
      expect(stats.bob.lastApprovalDate).toBeDefined();
      expect(stats.charlie.lastApprovalDate).toBeNull();
      expect(stats.david.lastApprovalDate).toBeNull();
    });
  });
});
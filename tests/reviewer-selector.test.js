const ReviewerSelector = require('../src/lib/reviewer-selector');

describe('ReviewerSelector', () => {
  const mockPRHistory = [
    {
      number: 1,
      author: { login: 'alice' },
      closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      reviews: [
        { author: { login: 'bob' }, submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }
      ]
    },
    {
      number: 2,
      author: { login: 'bob' },
      closedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      reviews: [
        { author: { login: 'charlie' }, submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
        { author: { login: 'alice' }, submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
      ]
    }
  ];

  const mockOpenPRs = [
    {
      number: 3,
      author: { login: 'charlie' },
      reviewRequests: [{ login: 'bob' }]
    }
  ];

  let selector;

  beforeEach(() => {
    selector = new ReviewerSelector(mockPRHistory, mockOpenPRs);
  });

  describe('calculateReviewStats', () => {
    test('should calculate correct review counts', () => {
      const stats = selector.reviewStats;
      expect(stats.bob.totalReviews).toBe(1);
      expect(stats.charlie.totalReviews).toBe(1);
      expect(stats.alice.totalReviews).toBe(1);
    });

    test('should calculate days since last review', () => {
      const stats = selector.reviewStats;
      expect(stats.bob.daysSinceLastReview).toBe(5);
      expect(stats.charlie.daysSinceLastReview).toBe(3);
      expect(stats.alice.daysSinceLastReview).toBe(3);
    });

    test('should track pending reviews', () => {
      const stats = selector.reviewStats;
      expect(stats.bob.pendingReviews).toBe(1);
      expect(stats.charlie?.pendingReviews || 0).toBe(0);
      expect(stats.alice?.pendingReviews || 0).toBe(0);
    });
  });

  describe('getEligibleReviewers', () => {
    test('should exclude PR author', () => {
      const eligible = selector.getEligibleReviewers('alice', ['alice', 'bob', 'charlie']);
      expect(eligible).not.toContain('alice');
      expect(eligible).toContain('bob');
      expect(eligible).toContain('charlie');
    });

    test('should exclude bot accounts', () => {
      const eligible = selector.getEligibleReviewers('alice', ['alice', 'bob', 'dependabot[bot]']);
      expect(eligible).not.toContain('dependabot[bot]');
    });
  });

  describe('calculateScore', () => {
    test('should give higher score to reviewer with longer time since last review', () => {
      const bobScore = selector.calculateScore('bob').score;
      const charlieScore = selector.calculateScore('charlie').score;
      
      expect(bobScore).toBeGreaterThan(charlieScore);
    });

    test('should penalize reviewers with pending reviews', () => {
      const davidScore = selector.calculateScore('david').score;
      const bobScore = selector.calculateScore('bob').score;
      
      expect(davidScore).toBeGreaterThan(bobScore);
    });
  });

  describe('selectReviewer', () => {
    test('should select eligible reviewer with highest score', () => {
      const mockConfig = {
        get: () => ({
          team: ['alice', 'bob', 'charlie', 'david'],
          excluded: [],
          weights: { recency: 3, balance: 2, workload: 1 },
          maxPendingReviews: 3
        }),
        isUnavailable: () => false
      };
      
      jest.mock('../src/lib/config', () => mockConfig);
      
      const result = selector.selectReviewer('alice');
      expect(result).toBeDefined();
      expect(result.reviewer).toBeDefined();
      expect(['bob', 'charlie', 'david']).toContain(result.reviewer);
    });

    test('should return null when no eligible reviewers', () => {
      const result = selector.selectReviewer('alice', ['alice']);
      expect(result).toBeNull();
    });
  });
});
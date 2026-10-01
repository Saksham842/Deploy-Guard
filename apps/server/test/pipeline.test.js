/**
 * DeployGuard — End-to-End Pipeline Smoke Test
 *
 * Mocks the complete lifecycle:
 *   1. pull_request.opened -> creates pending Check Run
 *   2. workflow_run.completed -> parses artifacts, saves check to DB, posts PR comment
 *   3. duplicate workflow_run.completed -> asserts idempotency short-circuit (no duplicate rows or comments)
 */

jest.mock('../src/db', () => ({
  pool:                 { query: jest.fn().mockResolvedValue({ rows: [] }) },
  getOrCreateRepo:      jest.fn(),
  getBaseline:          jest.fn(),
  upsertBaseline:       jest.fn(),
  saveCheck:            jest.fn(),
  getThresholds:        jest.fn(),
  getCheckByDeliveryId: jest.fn(),
  getCheckByRepoPrSha:  jest.fn(),
  updateRepoSetup:      jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/analysers/bundle', () => ({
  analyseBundle:    jest.fn(),
  computeChunkDiff: jest.fn().mockReturnValue([]),
}));

jest.mock('../src/analysers/packageDiff', () => ({
  diffPackageJson: jest.fn(),
}));

jest.mock('../src/nlp/client', () => ({
  classifyCommits: jest.fn(),
}));

jest.mock('@octokit/app', () => ({
  App: jest.fn().mockImplementation(() => ({
    webhooks: { on: jest.fn(), onError: jest.fn() },
  })),
  createNodeMiddleware: jest.fn(),
}));

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn(),
}));

jest.mock('../src/utils/groqExplain', () => ({
  getAIExplanation: jest.fn().mockResolvedValue('Mock AI Explanation'),
  getAISummary:     jest.fn().mockResolvedValue('Mock AI Summary'),
}));

const db = require('../src/db');
const { analyseBundle }   = require('../src/analysers/bundle');
const { diffPackageJson } = require('../src/analysers/packageDiff');
const { classifyCommits } = require('../src/nlp/client');
const { handlePR, handleWorkflowRun } = require('../src/webhook');

describe('DeployGuard Core Pipeline Smoke Test', () => {
  const MOCK_REPO = {
    id: 'uuid-repo-1',
    github_repo_id: 101,
    owner: 'acme-corp',
    name: 'web-app',
  };

  const MOCK_PR_PAYLOAD = {
    installation: { id: 999 },
    repository: {
      id: 101,
      owner: { login: 'acme-corp' },
      name: 'web-app',
    },
    pull_request: {
      number: 42,
      head: { sha: 'commit-sha-999' },
      base: { sha: 'base-sha-000', ref: 'main' },
    },
  };

  const MOCK_WORKFLOW_PAYLOAD = {
    installation: { id: 999 },
    repository: {
      id: 101,
      owner: { login: 'acme-corp' },
      name: 'web-app',
    },
    workflow_run: {
      id: 555,
      name: 'DeployGuard Bundle Stats',
      conclusion: 'success',
      head_sha: 'commit-sha-999',
      head_branch: 'feature-cart',
      pull_requests: [
        {
          number: 42,
          head: { sha: 'commit-sha-999' },
          base: { sha: 'base-sha-000', ref: 'main' },
        },
      ],
    },
  };

  let mockOctokit;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = {
      rest: {
        checks: {
          create: jest.fn().mockResolvedValue({ data: { id: 1001 } }),
          update: jest.fn().mockResolvedValue({}),
          listForRef: jest.fn().mockResolvedValue({
            data: { check_runs: [{ id: 1001, status: 'in_progress' }] },
          }),
        },
        pulls: {
          listCommits: jest.fn().mockResolvedValue({
            data: [
              { commit: { message: 'feat: add cart drawer' } },
            ],
          }),
          list: jest.fn().mockResolvedValue({ data: [] }),
        },
        issues: {
          createComment: jest.fn().mockResolvedValue({ data: { id: 9001 } }),
        },
      },
    };

    db.getOrCreateRepo.mockResolvedValue(MOCK_REPO);
    db.getThresholds.mockResolvedValue({ bundle_kb: 10, query_count: 20, api_p95_ms: 200 });
    db.getBaseline.mockResolvedValue({ value: 200, commit_sha: 'base-sha-000' });
    db.saveCheck.mockResolvedValue('check-uuid-42');
    db.getCheckByDeliveryId.mockResolvedValue(null);
    db.getCheckByRepoPrSha.mockResolvedValue(null);

    analyseBundle.mockResolvedValue({ totalKb: 205, chunks: [{ name: 'main.js', kb: 205 }] });
    diffPackageJson.mockResolvedValue({ added: [], removed: [], upgraded: [] });
    classifyCommits.mockResolvedValue([]);
  });

  test('pull_request.opened -> workflow_run.completed produces exactly 1 check row and 1 PR comment', async () => {
    // 1. Trigger PR open
    await handlePR({ octokit: mockOctokit, payload: MOCK_PR_PAYLOAD });

    // Assert initial pending check created
    expect(mockOctokit.rest.checks.create).toHaveBeenCalledTimes(1);
    expect(mockOctokit.rest.checks.create).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'acme-corp',
      repo: 'web-app',
      name: 'DeployGuard',
      head_sha: 'commit-sha-999',
      status: 'in_progress',
    }));

    // 2. Trigger CI workflow completion with delivery ID
    const deliveryId = 'gh-delivery-uuid-001';
    await handleWorkflowRun({
      id: deliveryId,
      octokit: mockOctokit,
      payload: MOCK_WORKFLOW_PAYLOAD,
    });

    // Assert check saved to DB with delivery ID
    expect(db.saveCheck).toHaveBeenCalledTimes(1);
    expect(db.saveCheck).toHaveBeenCalledWith(expect.objectContaining({
      repoId: 'uuid-repo-1',
      prNumber: 42,
      headSha: 'commit-sha-999',
      status: 'pass',
      githubDeliveryId: deliveryId,
    }));

    // Assert PR comment posted
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1);
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'acme-corp',
      repo: 'web-app',
      issue_number: 42,
    }));

    // Assert Check Run updated to completed/success
    expect(mockOctokit.rest.checks.update).toHaveBeenCalledWith(expect.objectContaining({
      check_run_id: 1001,
      status: 'completed',
      conclusion: 'success',
    }));
  });

  test('duplicate workflow_run webhook delivery is short-circuited and does not duplicate comments or checks', async () => {
    const deliveryId = 'gh-delivery-uuid-002';

    // First delivery succeeds
    await handleWorkflowRun({
      id: deliveryId,
      octokit: mockOctokit,
      payload: MOCK_WORKFLOW_PAYLOAD,
    });

    expect(db.saveCheck).toHaveBeenCalledTimes(1);
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1);

    // Simulate GitHub webhook retry where getCheckByDeliveryId now finds completed check
    db.getCheckByDeliveryId.mockResolvedValueOnce({
      id: 'check-uuid-42',
      status: 'pass',
      github_delivery_id: deliveryId,
    });

    // Second delivery with identical delivery ID
    await handleWorkflowRun({
      id: deliveryId,
      octokit: mockOctokit,
      payload: MOCK_WORKFLOW_PAYLOAD,
    });

    // Assert counts did not increase
    expect(db.saveCheck).toHaveBeenCalledTimes(1);
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledTimes(1);
  });
});

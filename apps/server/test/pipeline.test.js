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
const { handlePR, handleWorkflowRun, createSetupPR } = require('../src/webhook');

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

  test('pull_request.opened creates a neutral check with instructions when workflow file is missing', async () => {
    mockOctokit.rest.repos = {
      getContent: jest.fn().mockRejectedValue({ status: 404 }),
    };

    await handlePR({ octokit: mockOctokit, payload: MOCK_PR_PAYLOAD });

    expect(mockOctokit.rest.checks.create).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'acme-corp',
      repo: 'web-app',
      name: 'DeployGuard',
      status: 'completed',
      conclusion: 'neutral',
      output: expect.objectContaining({
        title: expect.stringContaining('Setup required'),
      }),
    }));
  });

  test('workflow_run.completed with failure conclusion updates pending check to failure', async () => {
    const failedPayload = {
      ...MOCK_WORKFLOW_PAYLOAD,
      workflow_run: {
        ...MOCK_WORKFLOW_PAYLOAD.workflow_run,
        conclusion: 'failure',
        html_url: 'https://github.com/acme-corp/web-app/actions/runs/555',
      },
    };

    await handleWorkflowRun({
      id: 'gh-delivery-uuid-failed',
      octokit: mockOctokit,
      payload: failedPayload,
    });

    expect(mockOctokit.rest.checks.update).toHaveBeenCalledWith(expect.objectContaining({
      check_run_id: 1001,
      status: 'completed',
      conclusion: 'failure',
      output: expect.objectContaining({
        title: expect.stringContaining('CI workflow failed'),
      }),
    }));
  });

  test('pull_request.opened automatically commits workflow file to active branch when missing and PR branch is internal', async () => {
    mockOctokit.rest.repos = {
      getContent: jest.fn().mockRejectedValue({ status: 404 }),
      createOrUpdateFileContents: jest.fn().mockResolvedValue({}),
    };

    const internalPRPayload = {
      ...MOCK_PR_PAYLOAD,
      pull_request: {
        ...MOCK_PR_PAYLOAD.pull_request,
        head: {
          sha: 'commit-sha-999',
          ref: 'feature-cart',
          repo: {
            fork: false,
            owner: { login: 'acme-corp' },
            name: 'web-app',
          },
        },
      },
    };

    await handlePR({ octokit: mockOctokit, payload: internalPRPayload });

    expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'acme-corp',
      repo: 'web-app',
      path: '.github/workflows/deployguard.yml',
      branch: 'feature-cart',
    }));

    expect(mockOctokit.rest.checks.create).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'acme-corp',
      repo: 'web-app',
      status: 'in_progress',
      output: expect.objectContaining({
        title: expect.stringContaining('DeployGuard workflow added to branch'),
      }),
    }));
  });

  test('createSetupPR commits directly to default branch when not blocked', async () => {
    const octokit = {
      rest: {
        repos: {
          getContent: jest.fn().mockRejectedValue({ status: 404 }),
          createOrUpdateFileContents: jest.fn().mockResolvedValue({}),
        },
      },
    };

    await createSetupPR({
      octokit,
      owner: 'acme-corp',
      repoName: 'web-app',
      defaultBranch: 'main',
      buildTool: 'vite',
      repoId: 'uuid-repo-1',
    });

    expect(octokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'acme-corp',
      repo: 'web-app',
      path: '.github/workflows/deployguard.yml',
      branch: 'main',
    }));
    expect(db.updateRepoSetup).toHaveBeenCalledWith('uuid-repo-1', { setup_status: 'merged' });
  });

  test('createSetupPR falls back to auto-merging setup PR if direct commit to default branch fails', async () => {
    const octokit = {
      rest: {
        repos: {
          getContent: jest.fn().mockRejectedValue({ status: 404 }),
          createOrUpdateFileContents: jest.fn()
            .mockRejectedValueOnce(new Error('Protected branch'))
            .mockResolvedValueOnce({}),
        },
        git: {
          getRef: jest.fn().mockResolvedValue({ data: { object: { sha: 'base-sha-123' } } }),
          createRef: jest.fn().mockResolvedValue({}),
        },
        pulls: {
          create: jest.fn().mockResolvedValue({
            data: { number: 7, html_url: 'https://github.com/acme-corp/web-app/pull/7' },
          }),
          merge: jest.fn().mockResolvedValue({}),
        },
      },
    };

    await createSetupPR({
      octokit,
      owner: 'acme-corp',
      repoName: 'web-app',
      defaultBranch: 'main',
      buildTool: 'vite',
      repoId: 'uuid-repo-1',
    });

    expect(octokit.rest.pulls.create).toHaveBeenCalled();
    expect(octokit.rest.pulls.merge).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'acme-corp',
      repo: 'web-app',
      pull_number: 7,
      merge_method: 'squash',
    }));
    expect(db.updateRepoSetup).toHaveBeenCalledWith('uuid-repo-1', {
      setup_pr_url: 'https://github.com/acme-corp/web-app/pull/7',
      setup_status: 'merged',
    });
  });
});



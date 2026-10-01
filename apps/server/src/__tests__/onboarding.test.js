const { detectBuildTool, getDefaultBranch } = require('../detect');
const { generateWorkflow } = require('../workflowTemplates');

describe('Phase 1: Build Tool Detection (detect.js)', () => {
  function makeOctokitWithPkg(dependencies = {}, devDependencies = {}) {
    const pkgContent = Buffer.from(
      JSON.stringify({ dependencies, devDependencies })
    ).toString('base64');

    return {
      rest: {
        repos: {
          getContent: jest.fn().mockResolvedValue({
            data: { content: pkgContent },
          }),
          get: jest.fn().mockResolvedValue({
            data: { default_branch: 'main' },
          }),
        },
      },
    };
  }

  test('detects nextjs when next is in dependencies', async () => {
    const octokit = makeOctokitWithPkg({ next: '^14.0.0', react: '^18.0.0' });
    const tool = await detectBuildTool(octokit, 'acme', 'next-app');
    expect(tool).toBe('nextjs');
  });

  test('detects vite when vite is in devDependencies', async () => {
    const octokit = makeOctokitWithPkg({ react: '^18.0.0' }, { vite: '^5.0.0' });
    const tool = await detectBuildTool(octokit, 'acme', 'vite-app');
    expect(tool).toBe('vite');
  });

  test('detects webpack when webpack is present without next', async () => {
    const octokit = makeOctokitWithPkg({}, { webpack: '^5.88.0' });
    const tool = await detectBuildTool(octokit, 'acme', 'webpack-app');
    expect(tool).toBe('webpack');
  });

  test('detects cra when react-scripts is present', async () => {
    const octokit = makeOctokitWithPkg({ 'react-scripts': '5.0.1' });
    const tool = await detectBuildTool(octokit, 'acme', 'cra-app');
    expect(tool).toBe('cra');
  });

  test('defaults to unknown when no recognizable bundler is found', async () => {
    const octokit = makeOctokitWithPkg({ express: '^4.18.0' });
    const tool = await detectBuildTool(octokit, 'acme', 'api-app');
    expect(tool).toBe('unknown');
  });

  test('defaults to unknown on getContent 404 or network failure', async () => {
    const octokit = {
      rest: {
        repos: {
          getContent: jest.fn().mockRejectedValue(new Error('Not Found')),
        },
      },
    };
    const tool = await detectBuildTool(octokit, 'acme', 'no-pkg');
    expect(tool).toBe('unknown');
  });

  test('getDefaultBranch returns default_branch from repository info', async () => {
    const octokit = {
      rest: {
        repos: {
          get: jest.fn().mockResolvedValue({ data: { default_branch: 'develop' } }),
        },
      },
    };
    const branch = await getDefaultBranch(octokit, 'acme', 'repo');
    expect(branch).toBe('develop');
  });
});

describe('Phase 1: Workflow Template Generation (workflowTemplates.js)', () => {
  test('generates Vite workflow with format "vite" and bundle-stats artifact', () => {
    const yaml = generateWorkflow('vite');
    expect(yaml).toContain('Build (Vite)');
    expect(yaml).toContain("format: 'vite'");
    expect(yaml).toContain('name: bundle-stats');
    expect(yaml).toContain('path: dist/');
  });

  test('generates Next.js workflow with format "nextjs"', () => {
    const yaml = generateWorkflow('nextjs');
    expect(yaml).toContain('Build (Next.js)');
    expect(yaml).toContain("format: 'nextjs'");
    expect(yaml).toContain('name: bundle-stats');
  });

  test('generates Webpack workflow with format "webpack"', () => {
    const yaml = generateWorkflow('webpack');
    expect(yaml).toContain('Build with stats (Webpack)');
    expect(yaml).toContain("format: 'webpack'");
    expect(yaml).toContain('name: bundle-stats');
  });

  test('generates CRA workflow with format "cra"', () => {
    const yaml = generateWorkflow('cra');
    expect(yaml).toContain('Build (CRA)');
    expect(yaml).toContain("format: 'cra'");
    expect(yaml).toContain('name: bundle-stats');
  });

  test('defaults to Vite workflow on unknown buildTool', () => {
    const yaml = generateWorkflow('unknown');
    expect(yaml).toContain('Build (Vite)');
  });
});

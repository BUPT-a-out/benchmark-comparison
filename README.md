# Benchmark Comparison System

A system for tracking and comparing compiler performance benchmarks across different commits.

## Features

- Automatic benchmark data collection from GitHub commits
- Performance score calculation based on best recorded times
- Visual comparison between any two commits
- Color-coded performance changes (green for improvements, red for regressions)
- GitHub integration for viewing commit details
- Responsive web interface with GitHub-style design

## Architecture

### Components

1. **Data Processing Script** (`scripts/process-benchmark.js`)
   - Fetches commit information from GitHub API
   - Processes TSV benchmark files
   - Calculates performance scores
   - Generates JSON data for frontend

2. **React Frontend** (`src/`)
   - Displays benchmark comparison interface
   - Allows selection of two commits for comparison
   - Shows performance metrics and changes
   - Color-coded visualization of improvements/regressions

3. **GitHub Actions Workflows**
   - `process-and-deploy.yml`: Processes data and deploys to GitHub Pages
   - `benchmark-on-commit.yml`: Runs benchmarks for new commits

## Performance Score Calculation

Each test case score is calculated as:
```
Score = 100 / (Runtime / Best Time)
```

The final score is the average of all test case scores.

**Note**: If a best time is recorded as 0.00 in `best.csv`, it's treated as 0.001 seconds to avoid division by zero.

## Setup

### Local Development

1. Install dependencies:
```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install Node.js dependencies
pnpm install
```

2. Process benchmark data:
```bash
pnpm run process
# or
node scripts/process-benchmark.js
```

3. Run development server:
```bash
pnpm run dev
```

### GitHub Pages Deployment

The site is automatically deployed to GitHub Pages when:
- New TSV files are added to the `results/` directory
- The `best.csv` file is updated
- Manual workflow dispatch is triggered

## File Structure

```
.
├── results/                 # Benchmark data
│   ├── best.csv            # Best times for each test case
│   └── *.tsv               # Benchmark results per commit
├── src/                    # React frontend source
├── scripts/               # Processing scripts
│   └── process-benchmark.js # Data processing script
├── .github/workflows/      # GitHub Actions workflows
└── package.json           # Project dependencies
```

## Usage

1. Visit the deployed site at: `https://[username].github.io/benchmark-comparison/`
2. Select a base commit (earlier) from the left dropdown
3. Select a compare commit (later) from the right dropdown
4. View the performance comparison and detailed benchmark results

## Color Coding

- **Green**: Performance improvement or score increase
- **Red**: Performance regression or score decrease
- **Gray**: Changes within ±2% threshold (considered neutral)

## API Integration

The system uses the GitHub API to fetch commit information:
- Commit messages
- Author information
- Timestamps
- GitHub URLs

Set `GITHUB_TOKEN` environment variable to avoid API rate limits.

## Contributing

1. Add new benchmark results as TSV files in the `results/` directory
2. Update `best.csv` when new best times are achieved
3. The CI/CD pipeline will automatically process and deploy changes
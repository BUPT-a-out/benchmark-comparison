#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const https = require('https');

/**
 * 获取GitHub commit信息
 */
async function getCommitInfo(sha) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/BUPT-a-out/compiler/commits/${sha}`,
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'benchmark-comparison'
    }
  };

  if (process.env.GITHUB_TOKEN) {
    options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve({
              sha: sha,
              message: parsed.commit.message,
              author: parsed.commit.author.name,
              author_email: parsed.commit.author.email,
              date: parsed.commit.author.date,
              url: parsed.html_url,
              parent_sha: parsed.parents[0]?.sha || null
            });
          } catch (e) {
            console.error(`Error parsing GitHub response for ${sha}:`, e);
            resolve(getDefaultCommitInfo(sha));
          }
        } else {
          console.error(`GitHub API returned status ${res.statusCode} for ${sha}`);
          resolve(getDefaultCommitInfo(sha));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`Error fetching commit info for ${sha}:`, e);
      resolve(getDefaultCommitInfo(sha));
    });

    req.end();
  });
}

function getDefaultCommitInfo(sha) {
  return {
    sha: sha,
    message: 'Unknown',
    author: 'Unknown',
    author_email: 'Unknown',
    date: new Date().toISOString(),
    url: `https://github.com/BUPT-a-out/compiler/commit/${sha}`,
    parent_sha: null
  };
}

/**
 * 读取最佳运行时间
 */
async function readBestTimes() {
  const bestTimes = {};
  const content = await fs.readFile('results/best.csv', 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const id = parseInt(values[0]);
    const name = values[1];
    let bestTime = parseFloat(values[2]);
    
    // 如果时间为0.00，则认为是0.0001秒
    if (bestTime === 0.0) {
      bestTime = 0.0001;
    }
    
    bestTimes[name] = {
      id: id,
      best_time: bestTime,
      original_best_time: parseFloat(values[2])  // 保存原始值用于判断
    };
  }
  
  return bestTimes;
}

/**
 * 解析TSV文件
 */
async function processTsvFile(filepath, bestTimes) {
  const results = [];
  const content = await fs.readFile(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split('\t');
    if (columns.length < 5) continue;
    
    const caseName = columns[1].trim();
    const timeStr = columns[3].trim();
    const status = columns[2].trim();
    
    const runtime = parseFloat(timeStr);
    if (isNaN(runtime)) {
      console.warn(`Warning: Cannot parse time for ${caseName}: ${timeStr}`);
      continue;
    }
    
    if (caseName in bestTimes) {
      const bestInfo = bestTimes[caseName];
      const bestTime = bestInfo.best_time;
      const correctId = bestInfo.id;
      
      // 计算分数的逻辑：
      // 1. 如果实际运行时间和最好运行时间都是0，得100分
      // 2. 如果实际运行时间不是0但最好运行时间是0，将最好运行时间当作0.0001s计算
      // 3. 如果实际运行时间小于等于最好运行时间，得100分
      // 4. 分数不能超过100分
      
      let score = 0;
      const originalBestTime = bestInfo.original_best_time;
      
      if (runtime === 0 && originalBestTime === 0) {
        // 两个都是0，得100分
        score = 100;
      } else if (runtime <= originalBestTime && originalBestTime > 0) {
        // 实际运行时间小于等于最好运行时间，得100分
        score = 100;
      } else if (originalBestTime === 0) {
        // 最好运行时间是0，当作0.0001计算
        const actualRuntime = runtime === 0 ? 0.0001 : runtime;
        score = 100 / (actualRuntime / 0.0001);
      } else if (runtime === 0) {
        // 只有运行时间是0，当作0.0001计算
        score = 100 / (0.0001 / originalBestTime);
      } else {
        // 正常计算
        score = 100 / (runtime / originalBestTime);
      }
      
      // 确保分数不超过100
      score = Math.min(score, 100);
      
      results.push({
        id: correctId,
        name: caseName,
        runtime: runtime,
        best_time: bestTime,
        score: score,
        status: status
      });
    } else {
      console.warn(`Warning: Case ${caseName} not found in best.csv`);
    }
  }
  
  // 按ID排序
  results.sort((a, b) => a.id - b.id);
  
  // 计算平均分
  const avgScore = results.length > 0
    ? results.reduce((sum, r) => sum + r.score, 0) / results.length
    : 0;
  
  return { results, avgScore };
}

/**
 * 主函数
 */
async function main() {
  try {
    const resultsDir = 'results';
    const outputDir = 'data';
    
    // 创建输出目录
    await fs.mkdir(outputDir, { recursive: true });
    
    // 读取最佳时间
    console.log('Reading best times...');
    const bestTimes = await readBestTimes();
    
    // 获取所有TSV文件
    const files = await fs.readdir(resultsDir);
    const tsvFiles = files.filter(f => f.endsWith('.tsv'));
    
    console.log(`Found ${tsvFiles.length} TSV files to process`);
    
    // 处理所有的TSV文件
    const allCommits = [];
    
    for (const tsvFile of tsvFiles) {
      const sha = path.basename(tsvFile, '.tsv');
      console.log(`Processing ${sha}...`);
      
      // 获取commit信息
      const commitInfo = await getCommitInfo(sha);
      
      // 处理benchmark数据
      const { results, avgScore } = await processTsvFile(
        path.join(resultsDir, tsvFile),
        bestTimes
      );
      
      // 合并数据
      const commitData = {
        ...commitInfo,
        average_score: avgScore,
        benchmarks: results
      };
      
      allCommits.push(commitData);
    }
    
    // 按时间排序
    allCommits.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 保存为JSON
    const outputData = {
      commits: allCommits,
      best_times: bestTimes,
      generated_at: new Date().toISOString()
    };
    
    const outputFile = path.join(outputDir, 'benchmark_data.json');
    await fs.writeFile(
      outputFile,
      JSON.stringify(outputData, null, 2),
      'utf-8'
    );
    
    console.log(`Data saved to ${outputFile}`);
    console.log(`Processed ${allCommits.length} commits`);
  } catch (error) {
    console.error('Error processing benchmarks:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');

// Promisify fs functions
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const execPromise = promisify(exec);

// Initialize turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

// Customize turndown to better handle certain elements
turndownService.addRule('removeEmptyParagraphs', {
  filter: node => node.nodeName === 'P' && node.textContent.trim() === '',
  replacement: () => ''
});

// Conversion function using TurndownService
async function convertWithTurndown(htmlContent) {
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  
  // Use Readability to extract the main content
  const reader = new Readability(document);
  const article = reader.parse();
  
  // If article was successfully parsed, use its content
  const contentToConvert = article ? article.content : document.body.innerHTML;
  
  // Convert to markdown
  const markdown = turndownService.turndown(contentToConvert);
  
  // Clean up the markdown (remove multiple blank lines, etc.)
  return markdown
    .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
    .trim();
}

// Conversion function using markitdown command-line tool
async function convertWithMarkitdown(htmlFilePath, markdownFilePath) {
  try {
    // Execute the markitdown command
    await execPromise(`markitdown "${htmlFilePath}" > "${markdownFilePath}"`);
    return true;
  } catch (error) {
    console.error(`Error executing markitdown: ${error.message}`);
    throw error;
  }
}

// Function to recursively process directories
async function processDirectory(sourceDir, targetDir, relativePath = '', useMarkitdown = false) {
  const currentSourceDir = path.join(sourceDir, relativePath);
  const currentTargetDir = path.join(targetDir, relativePath);
  
  // Create target directory if it doesn't exist
  if (!fs.existsSync(currentTargetDir)) {
    await mkdir(currentTargetDir, { recursive: true });
  }
  
  // Read directory contents
  const items = await readdir(currentSourceDir);
  
  for (const item of items) {
    const sourcePath = path.join(currentSourceDir, item);
    const itemRelativePath = path.join(relativePath, item);
    const stats = await stat(sourcePath);
    
    if (stats.isDirectory()) {
      // Recursively process subdirectories
      await processDirectory(sourceDir, targetDir, itemRelativePath, useMarkitdown);
    } else if (stats.isFile() && path.extname(item).toLowerCase() === '.html') {
      // Process HTML files
      try {
        console.log(`Converting ${itemRelativePath}...`);
        
        // Change extension to .md
        const targetPath = path.join(
          currentTargetDir, 
          path.basename(item, '.html') + '.md'
        );
        
        if (useMarkitdown) {
          // Use markitdown system command
          await convertWithMarkitdown(sourcePath, targetPath);
        } else {
          // Use TurndownService
          const htmlContent = await readFile(sourcePath, 'utf8');
          const markdown = await convertWithTurndown(htmlContent);
          await writeFile(targetPath, markdown, 'utf8');
        }
        
        console.log(`Successfully converted: ${itemRelativePath}`);
      } catch (error) {
        console.error(`Error converting ${itemRelativePath}: ${error.message}`);
      }
    }
  }
}

// Main function to start the conversion process
async function convertHtmlFilesToMarkdown(sourceDir, targetDir, useMarkitdown = false) {
  try {
    console.log(`Starting conversion from ${sourceDir} to ${targetDir}`);
    console.log(`Using ${useMarkitdown ? 'markitdown system command' : 'TurndownService'} for conversion`);
    
    // Create root target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
    }
    
    // Process all directories and files
    await processDirectory(sourceDir, targetDir, '', useMarkitdown);
    
    console.log('Conversion completed successfully!');
  } catch (error) {
    console.error(`Conversion failed: ${error.message}`);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    sourceDir: './html_files',
    targetDir: './markdown_files',
    useMarkitdown: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' || args[i] === '-s') {
      options.sourceDir = args[i + 1];
      i++;
    } else if (args[i] === '--target' || args[i] === '-t') {
      options.targetDir = args[i + 1];
      i++;
    } else if (args[i] === '--use-markitdown' || args[i] === '-m') {
      options.useMarkitdown = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

// Print help information
function printHelp() {
  console.log(`
HTML to Markdown Converter

Usage:
  node converter.js [options]

Options:
  -s, --source <dir>      Source directory containing HTML files (default: ./html_files)
  -t, --target <dir>      Target directory for Markdown files (default: ./markdown_files)
  -m, --use-markitdown    Use markitdown system command instead of TurndownService
  -h, --help              Show this help message
  `);
}

// If called directly (not imported)
if (require.main === module) {
  const options = parseArgs();
  
  // Run the conversion with parsed options
  convertHtmlFilesToMarkdown(options.sourceDir, options.targetDir, options.useMarkitdown);
}

// Export for use as a module
module.exports = {
  convertHtmlFilesToMarkdown
};

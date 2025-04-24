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

// Process HTML content to adjust links before conversion
function adjustHtmlLinks(htmlContent, domain) {
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  
  // Process all anchor links
  const links = document.querySelectorAll('a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/')) {
      link.setAttribute('href', `${domain}${href}`);
    }
  });
  
  // Process all image sources
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.startsWith('/')) {
      img.setAttribute('src', `${domain}${src}`);
    }
  });
  
  return dom.serialize();
}

// Conversion function using TurndownService
async function convertWithTurndown(htmlContent, domain) {
  // Adjust links in HTML
  const adjustedHtml = adjustHtmlLinks(htmlContent, domain);
  
  const dom = new JSDOM(adjustedHtml);
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
async function convertWithMarkitdown(htmlFilePath, markdownFilePath, domain) {
  try {
    // Read HTML content first
    const htmlContent = await readFile(htmlFilePath, 'utf8');
    
    // Adjust links in HTML
    const adjustedHtml = adjustHtmlLinks(htmlContent, domain);
    
    // Write adjusted HTML to a temporary file
    const tempHtmlPath = `${htmlFilePath}.temp`;
    await writeFile(tempHtmlPath, adjustedHtml, 'utf8');
    
    // Execute the markitdown command with the temp file
    await execPromise(`markitdown "${tempHtmlPath}" > "${markdownFilePath}"`);
    
    // Remove the temporary file
    fs.unlinkSync(tempHtmlPath);
    
    return true;
  } catch (error) {
    console.error(`Error executing markitdown: ${error.message}`);
    throw error;
  }
}

// Function to recursively process directories
async function processDirectory(sourceDir, targetDir, relativePath = '', options = {}) {
  const { useMarkitdown = false, domain = 'domain.com' } = options;
  
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
      await processDirectory(sourceDir, targetDir, itemRelativePath, options);
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
          await convertWithMarkitdown(sourcePath, targetPath, domain);
        } else {
          // Use TurndownService
          const htmlContent = await readFile(sourcePath, 'utf8');
          const markdown = await convertWithTurndown(htmlContent, domain);
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
async function convertHtmlFilesToMarkdown(sourceDir, targetDir, options = {}) {
  try {
    const { useMarkitdown = false, domain = 'domain.com' } = options;
    
    console.log(`Starting conversion from ${sourceDir} to ${targetDir}`);
    console.log(`Using ${useMarkitdown ? 'markitdown system command' : 'TurndownService'} for conversion`);
    console.log(`Links starting with '/' will be prepended with '${domain}'`);
    
    // Create root target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
    }
    
    // Process all directories and files
    await processDirectory(sourceDir, targetDir, '', options);
    
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
    useMarkitdown: false,
    domain: 'domain.com'
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
    } else if (args[i] === '--domain' || args[i] === '-d') {
      options.domain = args[i + 1];
      i++;
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
  node index.js [options]

Options:
  -s, --source <dir>      Source directory containing HTML files (default: ./html_files)
  -t, --target <dir>      Target directory for Markdown files (default: ./markdown_files)
  -m, --use-markitdown    Use markitdown system command instead of TurndownService
  -d, --domain <domain>   Domain to prepend to links starting with '/' (default: domain.com)
  -h, --help              Show this help message
  `);
}

// If called directly (not imported)
if (require.main === module) {
  const options = parseArgs();
  
  // Run the conversion with parsed options
  convertHtmlFilesToMarkdown(
    options.sourceDir, 
    options.targetDir, 
    {
      useMarkitdown: options.useMarkitdown,
      domain: options.domain
    }
  );
}

// Export for use as a module
module.exports = {
  convertHtmlFilesToMarkdown
};
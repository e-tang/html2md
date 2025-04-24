# HTML to Markdown Converter

A comprehensive Node.js utility that converts HTML files to Markdown format while preserving directory structure. Perfect for documentation migration, content management system transitions, or preparing web content for integration with RAG (Retrieval-Augmented Generation) AI systems.

## Features

- Converts HTML files to clean, readable Markdown
- Preserves original directory structure
- Provides two conversion methods:
  - TurndownService (JavaScript library)
  - markitdown (command-line tool)
- Extracts meaningful content using Mozilla's Readability
- Handles errors gracefully for individual files
- Provides command-line options for customization

## Installation

1. Clone this repository or download the script:
   ```bash
   git clone https://github.com/e-tang/html2md.git
   cd html2md
   ```

2. Install dependencies:
   ```bash
   npm install @mozilla/readability jsdom turndown
   ```

3. Make the script executable (optional):
   ```bash
   chmod +x index.js
   ```

## Installing markitdown
```bash
# Create a new virtual environment if needed with conda or venv
# conda create -n markitdown python=3.8
# conda activate markitdown
git clone git@github.com:microsoft/markitdown.git
cd markitdown
pip install -e 'packages/markitdown[all]'
```

## Usage

### Basic Usage

```bash
node index.js --source ./my_html_files --target ./my_markdown_files
```

### Command Line Options

```
Usage:
  node index.js [options]

Options:
  -s, --source <dir>      Source directory containing HTML files (default: ./html_files)
  -t, --target <dir>      Target directory for Markdown files (default: ./markdown_files)
  -m, --use-markitdown    Use markitdown system command instead of TurndownService
  -h, --help              Show this help message
```

### Examples

Convert using TurndownService (default):
```bash
node index.js --source ./website_content --target ./md_content
```

Convert using markitdown command-line tool:
```bash
node index.js --source ./website_content --target ./md_content --use-markitdown
```

Show help information:
```bash
node index.js --help
```

## Using as a Module

You can also import and use this converter in your own Node.js applications:

```javascript
const { convertHtmlFilesToMarkdown } = require('./converter');

// Convert HTML files to Markdown
convertHtmlFilesToMarkdown('./source_dir', './target_dir', false);
```

## How It Works

1. The script recursively traverses all directories starting from your source directory
2. It identifies HTML files and processes them using your chosen conversion method
3. When using TurndownService:
   - Readability extracts the main content of the HTML
   - TurndownService converts the HTML to Markdown
   - The script applies formatting cleanup
4. When using markitdown:
   - The script executes the markitdown command-line tool
5. The same directory structure is preserved in the target location

## Troubleshooting

1. **Error: Cannot find module '@mozilla/readability'**
   - Ensure you've run `npm install` in the project directory

2. **Error: markitdown command not found**
   - Ensure markitdown is installed globally: `npm install -g markitdown`
   - Check if the global npm bin directory is in your PATH

3. **Permission errors**
   - Make sure you have read permissions for source files and write permissions for the target directory

## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.